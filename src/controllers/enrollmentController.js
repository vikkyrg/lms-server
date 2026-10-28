const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Module = require('../models/Module');
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');
const { addCalendarMonths, isEnrollmentActive } = require('../utils/accessDuration');
const { logAudit } = require('../utils/audit');
const { sendEmail } = require('../utils/email');

// Helper to check and mark expired enrollments on read
const refreshEnrollmentStatus = async (enrollment) => {
  if (!enrollment) return null;
  if (['approved', 'completed'].includes(enrollment.status) && enrollment.accessExpiryDate) {
    if (new Date() >= new Date(enrollment.accessExpiryDate)) {
      enrollment.status = 'expired';
      await enrollment.save();
    }
  }
  return enrollment;
};

// @desc Request free course enrollment (awaiting Admin approval)
// @route POST /api/v1/enrollments/free
exports.enrollFree = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.id;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course id' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Cannot enroll in an unpublished course' });
    }

    if (!course.isFree && course.price > 0) {
      return res.status(400).json({ success: false, message: 'This course requires payment' });
    }

    const existing = await Enrollment.findOne({ student: studentId, course: courseId });
    if (existing) {
      if (['approved', 'completed'].includes(existing.status) && isEnrollmentActive(existing)) {
        return res.status(400).json({ success: false, message: 'You already have active access to this course' });
      }
      if (existing.status === 'pending_approval') {
        return res.status(400).json({ success: false, message: 'Your enrollment is already awaiting Admin approval' });
      }
    }

    let enrollment = existing;
    if (enrollment) {
      enrollment.status = 'pending_approval';
      enrollment.enrolledAt = new Date();
      enrollment.accessStartDate = null;
      enrollment.accessExpiryDate = null;
      await enrollment.save();
    } else {
      enrollment = await Enrollment.create({
        student: studentId,
        course: courseId,
        status: 'pending_approval' // Exact AutoOps School workflow
      });
      await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } });
    }

    res.status(201).json({
      success: true,
      message: 'Your enrollment request has been submitted and is awaiting Admin approval.',
      status: 'pending_approval',
      enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get student's enrollments with active status & remaining days
// @route GET /api/v1/enrollments/my
exports.getMyEnrollments = async (req, res, next) => {
  try {
    const rawEnrollments = await Enrollment.find({ student: req.user.id })
      .populate('course', 'title thumbnail shortDescription duration slug price discountPrice isFree')
      .populate('payment', 'amount currency status orderId paymentId createdAt')
      .sort('-createdAt');

    // Auto-update any that have passed their 3-month expiry
    const enrollments = [];
    for (const enr of rawEnrollments) {
      await refreshEnrollmentStatus(enr);
      const enrObj = enr.toObject();

      // Compute days remaining
      if (enr.accessExpiryDate && ['approved', 'completed'].includes(enr.status)) {
        const diffMs = new Date(enr.accessExpiryDate) - new Date();
        enrObj.daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        enrObj.hasActiveAccess = diffMs > 0;
      } else {
        enrObj.daysRemaining = 0;
        enrObj.hasActiveAccess = false;
      }

      enrollments.push(enrObj);
    }

    res.status(200).json({ success: true, count: enrollments.length, enrollments });
  } catch (error) {
    next(error);
  }
};

// @desc Check student enrollment status for a specific course
// @route GET /api/v1/enrollments/check/:courseId
exports.checkEnrollment = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: req.params.courseId
    });

    if (enrollment) {
      await refreshEnrollmentStatus(enrollment);
    }

    const isActive = isEnrollmentActive(enrollment);

    res.status(200).json({
      success: true,
      isEnrolled: !!enrollment,
      hasActiveAccess: isActive,
      status: enrollment ? enrollment.status : 'not_enrolled',
      enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get course classroom content (Strictly approved students with active 3-month window or Admin)
// @route GET /api/v1/enrollments/classroom/:courseId
exports.getClassroom = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course id' });
    }

    let isAuthorized = req.user.role === 'admin';
    let enrollment = null;

    if (!isAuthorized) {
      enrollment = await Enrollment.findOne({
        student: userId,
        course: courseId
      });

      if (!enrollment) {
        return res.status(403).json({ success: false, message: 'You must be enrolled to access this classroom' });
      }

      await refreshEnrollmentStatus(enrollment);

      if (enrollment.status === 'pending_approval') {
        return res.status(403).json({
          success: false,
          code: 'PENDING_APPROVAL',
          message: 'Your payment was successful. Your course enrollment is awaiting Admin approval. You will receive access once approved.'
        });
      }

      if (enrollment.status === 'rejected') {
        return res.status(403).json({
          success: false,
          code: 'ENROLLMENT_REJECTED',
          message: enrollment.rejectionReason
            ? `Your enrollment was rejected by Admin. Reason: ${enrollment.rejectionReason}`
            : 'Your course enrollment was rejected by Admin.'
        });
      }

      if (!isEnrollmentActive(enrollment)) {
        return res.status(403).json({
          success: false,
          code: 'ACCESS_EXPIRED',
          message: 'Your three-month course access period has expired.'
        });
      }
    }

    const course = await Course.findById(courseId).populate('instructor', 'name avatar headline');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const modules = await Module.find({ courseId }).sort('order');
    const lessons = await Lesson.find({ courseId }).sort('order');

    const curriculum = modules.map(m => ({
      ...m.toObject(),
      lessons: lessons.filter(l => l.moduleId.toString() === m._id.toString())
    }));

    res.status(200).json({
      success: true,
      course,
      curriculum,
      enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark lesson as completed
// @route POST /api/v1/enrollments/complete-lesson
exports.completeLesson = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.body;
    const studentId = req.user.id;

    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
      return res.status(400).json({ success: false, message: 'Invalid course or lesson id' });
    }

    const lesson = await Lesson.findOne({ _id: lessonId, courseId }).select('_id');
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson does not belong to this course' });
    }

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    if (!isEnrollmentActive(enrollment) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Course access has expired or is not active' });
    }

    if (!enrollment.completedLessons.includes(lessonId)) {
      enrollment.completedLessons.push(lessonId);
    }
    enrollment.lastAccessedLesson = lessonId;

    // Calculate progress
    const courseLessons = await Lesson.find({ courseId }).select('_id');
    const lessonIds = new Set(courseLessons.map(item => item._id.toString()));
    enrollment.completedLessons = enrollment.completedLessons.filter(id => lessonIds.has(id.toString()));
    const totalLessons = courseLessons.length;
    const completedCount = new Set(enrollment.completedLessons.map(id => id.toString())).size;
    const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 100;

    enrollment.progress = Math.min(progress, 100);
    if (enrollment.progress >= 100 && enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
    }

    await enrollment.save();

    res.status(200).json({ success: true, progress: enrollment.progress, enrollment });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// ADMIN ENROLLMENT APPROVAL MANAGEMENT CONTROLLERS
// =========================================================================

// @desc Get all enrollments with filters (Admin)
// Filters: pending_approval, approved, rejected, expired, all
// @route GET /api/v1/enrollments/admin/list
exports.getAdminEnrollments = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const rawList = await Enrollment.find(filter)
      .populate('student', 'name email phone avatar createdAt')
      .populate('course', 'title thumbnail price discountPrice isFree duration slug')
      .populate('payment', 'amount currency status orderId paymentId paymentMethod createdAt')
      .populate('approvedBy', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    // Refresh expiration for list items
    const enrollments = [];
    for (const enr of rawList) {
      await refreshEnrollmentStatus(enr);
      const enrObj = enr.toObject();
      if (enr.accessExpiryDate && ['approved', 'completed'].includes(enr.status)) {
        const diffMs = new Date(enr.accessExpiryDate) - new Date();
        enrObj.daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      } else {
        enrObj.daysRemaining = 0;
      }
      enrollments.push(enrObj);
    }

    const total = await Enrollment.countDocuments(filter);

    res.status(200).json({
      success: true,
      enrollments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Approve student enrollment and grant 3 calendar months access (Admin)
// @route PUT /api/v1/enrollments/admin/:id/approve
exports.approveEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid enrollment ID' });
    }

    const enrollment = await Enrollment.findById(id)
      .populate('student', 'name email phone')
      .populate('course', 'title price isFree')
      .populate('payment');

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    // Safety guard: a paid course may only be approved once the Razorpay
    // payment linked to this enrollment is verified as captured by the backend.
    // Free courses never require a payment record.
    const isPaidCourse = !!enrollment.course
      && !enrollment.course.isFree
      && Number(enrollment.course.price || 0) > 0;
    if (isPaidCourse) {
      if (!enrollment.payment) {
        return res.status(400).json({
          success: false,
          message: 'Cannot approve a paid-course enrollment without a linked payment record'
        });
      }
      if (enrollment.payment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: `Cannot approve enrollment with payment status '${enrollment.payment.status}'. Access requires a verified payment.`
        });
      }
    }

    const startDate = new Date();
    const expiryDate = addCalendarMonths(startDate, 3); // Exact 3 calendar months calculation

    enrollment.status = 'approved';
    enrollment.accessStartDate = startDate;
    enrollment.accessExpiryDate = expiryDate;
    enrollment.approvedAt = startDate;
    enrollment.approvedBy = req.user.id;
    enrollment.rejectedAt = null;
    enrollment.rejectionReason = '';

    await enrollment.save();

    await logAudit({
      action: 'ENROLLMENT_APPROVED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Enrollment',
      targetId: enrollment._id,
      details: {
        student: enrollment.student?.email,
        course: enrollment.course?.title,
        accessStartDate: startDate,
        accessExpiryDate: expiryDate
      }
    });

    // Notify student via email if mail server is configured
    try {
      if (enrollment.student?.email) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        await sendEmail({
          to: enrollment.student.email,
          subject: `Enrollment Approved: ${enrollment.course?.title}`,
          text: `Hello ${enrollment.student.name},\n\nYour course enrollment has been approved by the Admin! You now have active 3-month access.\n\nAccess starts: ${startDate.toDateString()}\nAccess expires: ${expiryDate.toDateString()}\n\nGo to your classroom: ${clientUrl}/student/courses/${enrollment.course?._id}\n\nAutoOps School Team`
        });
      }
    } catch (mailErr) {
      console.warn('Student approval notification non-blocking warning:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment approved. 3-calendar-month access has been activated.',
      data: enrollment,
      enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc Reject student enrollment (Admin)
// @route PUT /api/v1/enrollments/admin/:id/reject
exports.rejectEnrollment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid enrollment ID' });
    }

    const enrollment = await Enrollment.findById(id)
      .populate('student', 'name email')
      .populate('course', 'title');

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    enrollment.status = 'rejected';
    enrollment.rejectedAt = new Date();
    enrollment.rejectionReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';

    await enrollment.save();

    await logAudit({
      action: 'ENROLLMENT_REJECTED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Enrollment',
      targetId: enrollment._id,
      details: {
        student: enrollment.student?.email,
        course: enrollment.course?.title,
        reason: enrollment.rejectionReason
      }
    });

    try {
      if (enrollment.student?.email) {
        await sendEmail({
          to: enrollment.student.email,
          subject: `Enrollment Update: ${enrollment.course?.title}`,
          text: `Hello ${enrollment.student.name},\n\nYour enrollment request for "${enrollment.course?.title}" was not approved by the Admin.${enrollment.rejectionReason ? `\nReason: ${enrollment.rejectionReason}` : ''}\n\nIf you have any questions, please contact support.\n\nAutoOps School Team`
        });
      }
    } catch (mailErr) {
      console.warn('Student rejection notification non-blocking warning:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment marked as rejected.',
      enrollment
    });
  } catch (error) {
    next(error);
  }
};
