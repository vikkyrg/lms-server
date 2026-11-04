const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Enquiry = require('../models/Enquiry');
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Admin Analytics & KPIs
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ status: 'published' });
    const totalEnrollments = await Enrollment.countDocuments();
    const pendingApprovals = await Enrollment.countDocuments({ status: 'pending_approval' });
    const approvedEnrollments = await Enrollment.countDocuments({ status: 'approved' });
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });

    // Revenue Aggregation
    const revenueAgg = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    const grossRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // Recent Registrations
    const recentStudents = await User.find({ role: 'student' })
      .select('name email createdAt isActive')
      .sort('-createdAt')
      .limit(5);

    // Recent Payments
    const recentPayments = await Payment.find({ status: 'completed' })
      .populate('student', 'name email')
      .populate('course', 'title')
      .sort('-createdAt')
      .limit(5);

    // Top Courses
    const topCourses = await Course.find({ status: 'published' })
      .select('title enrollmentCount price rating')
      .sort('-enrollmentCount')
      .limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalCourses,
        publishedCourses,
        totalEnrollments,
        pendingApprovals,
        approvedEnrollments,
        grossRevenue,
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
      },
      recentStudents,
      recentPayments,
      topCourses
    });
  } catch (error) {
    next(error);
  }
};

// Student Directory management (exclusively role: 'student')
exports.getUsers = async (req, res, next) => {
  try {
    const { status, search, courseId, sort, startDate, endDate } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    // STRICT: Only return accounts with role 'student'. Admins are never exposed here.
    const query = { role: 'student' };

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
      if (Object.keys(query.createdAt).length === 0) {
        delete query.createdAt;
      }
    }

    // Filter by enrolled course if courseId is passed
    if (courseId && require('mongoose').isValidObjectId(courseId)) {
      const enrolledStudentIds = await Enrollment.distinct('student', {
        course: courseId,
        status: { $in: ['approved', 'completed', 'pending_approval'] }
      });
      query._id = { $in: enrolledStudentIds };
    }

    // Calculate real stats for student summary cards
    const [totalStudents, activeStudents, inactiveStudents, enrolledStudentsCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'student', isActive: false }),
      Enrollment.distinct('student', { status: { $in: ['approved', 'completed', 'pending_approval'] } })
        .then(ids => ids.length)
    ]);

    const stats = {
      totalStudents,
      activeStudents,
      inactiveStudents,
      enrolledStudents: enrolledStudentsCount
    };

    // Determine sort
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'name_asc') {
      sortOption = { name: 1 };
    } else if (sort === 'name_desc') {
      sortOption = { name: -1 };
    }

    const skip = (page - 1) * limit;
    const rawStudents = await User.find(query)
      .select('-password')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);

    // Fetch enrollments with course details and payments for these students
    const studentIds = rawStudents.map(s => s._id);
    const [enrollmentsList, paymentsList] = await Promise.all([
      Enrollment.find({ student: { $in: studentIds } })
        .populate('course', 'title slug price discountPrice isFree')
        .lean(),
      Payment.find({ student: { $in: studentIds } })
        .select('student amount status createdAt')
        .lean()
    ]);

    // Map enrollments by student
    const enrollmentsByStudent = new Map();
    enrollmentsList.forEach((enr) => {
      const sId = enr.student.toString();
      if (!enrollmentsByStudent.has(sId)) {
        enrollmentsByStudent.set(sId, []);
      }
      enrollmentsByStudent.get(sId).push(enr);
    });

    // Map payments by student
    const paymentsByStudent = new Map();
    paymentsList.forEach((p) => {
      const sId = p.student.toString();
      if (!paymentsByStudent.has(sId)) {
        paymentsByStudent.set(sId, []);
      }
      paymentsByStudent.get(sId).push(p);
    });

    const users = rawStudents.map(s => {
      const sId = s._id.toString();
      const studentEnrollments = enrollmentsByStudent.get(sId) || [];
      const studentPayments = paymentsByStudent.get(sId) || [];

      // Determine consolidated payment status
      // Paid / Partial / Pending / Free / None
      let paymentStatus = 'none';
      if (studentEnrollments.length > 0) {
        const hasVerifiedOrCompleted = studentPayments.some(p => p.status === 'verified' || p.status === 'completed') ||
          studentEnrollments.some(e => e.paymentStatus === 'verified' || e.paymentStatus === 'completed');
        const hasPendingVerification = studentPayments.some(p => p.status === 'pending_verification' || p.status === 'created') ||
          studentEnrollments.some(e => e.paymentStatus === 'pending_verification');
        const allFree = studentEnrollments.every(e => e.paymentStatus === 'free' || e.course?.isFree);

        if (hasVerifiedOrCompleted) {
          paymentStatus = 'paid';
        } else if (hasPendingVerification) {
          paymentStatus = 'pending';
        } else if (allFree) {
          paymentStatus = 'free';
        } else {
          paymentStatus = 'pending';
        }
      }

      const enrolledCourses = studentEnrollments.map(e => ({
        id: e.course?._id,
        title: e.course?.title || 'Unknown Course',
        status: e.status,
        progress: e.progress || 0
      }));

      return {
        ...s,
        enrolledCoursesCount: studentEnrollments.length,
        enrolledCourses,
        paymentStatus
      };
    });

    res.status(200).json({
      success: true,
      stats,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get comprehensive student profile & learning progress
// @route GET /api/v1/admin/users/:id/details
exports.getStudentDetails = async (req, res, next) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('-password')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    const [enrollments, certificates, payments, submissions] = await Promise.all([
      Enrollment.find({ student: student._id })
        .populate('course', 'title thumbnail shortDescription duration slug price discountPrice isFree modules')
        .populate('payment', 'amount currency status orderId paymentId createdAt')
        .sort('-createdAt')
        .lean(),
      require('../models/Certificate').find({ studentId: student._id })
        .populate('courseId', 'title thumbnail')
        .sort('-issueDate')
        .lean(),
      Payment.find({ student: student._id })
        .populate('course', 'title')
        .sort('-createdAt')
        .lean(),
      require('../models/Submission').find({ studentId: student._id })
        .populate('assignmentId', 'title isProject totalMarks passingMarks')
        .populate('courseId', 'title')
        .sort('-createdAt')
        .lean()
    ]);

    // Calculate module/lesson details for learning progress tab
    // Fetch all lessons count for the enrolled courses
    const courseIds = enrollments.map(e => e.course?._id).filter(Boolean);
    const [allModules, allLessons] = await Promise.all([
      require('../models/Module').find({ courseId: { $in: courseIds } }).lean(),
      require('../models/Lesson').find({ courseId: { $in: courseIds } }).select('_id title moduleId courseId duration').lean()
    ]);

    const modulesByCourse = new Map();
    allModules.forEach(m => {
      const cId = m.courseId.toString();
      if (!modulesByCourse.has(cId)) modulesByCourse.set(cId, []);
      modulesByCourse.get(cId).push(m);
    });

    const lessonsByCourse = new Map();
    allLessons.forEach(l => {
      const cId = l.courseId.toString();
      if (!lessonsByCourse.has(cId)) lessonsByCourse.set(cId, []);
      lessonsByCourse.get(cId).push(l);
    });

    const detailedEnrollments = enrollments.map(enr => {
      const cId = enr.course?._id?.toString();
      const courseLessons = (cId && lessonsByCourse.get(cId)) || [];
      const courseModules = (cId && modulesByCourse.get(cId)) || [];
      const totalLessonsCount = courseLessons.length;
      const completedCount = (enr.completedLessons || []).length;
      const pendingCount = Math.max(0, totalLessonsCount - completedCount);

      return {
        ...enr,
        totalLessonsCount,
        completedLessonsCount: completedCount,
        pendingLessonsCount: pendingCount,
        totalModulesCount: courseModules.length
      };
    });

    res.status(200).json({
      success: true,
      student,
      enrollments: detailedEnrollments,
      certificates,
      payments,
      submissions
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update student account status or basic details (admin safe)
// @route PUT /api/v1/admin/users/:id
exports.updateUserStatus = async (req, res, next) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    const { isActive, name, phone } = req.body || {};

    if (isActive !== undefined) {
      student.isActive = Boolean(isActive);
    }
    if (name && typeof name === 'string' && name.trim()) {
      student.name = name.trim();
    }
    if (phone !== undefined && typeof phone === 'string') {
      student.phone = phone.trim();
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student account updated successfully',
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        isActive: student.isActive,
        role: student.role,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Enquiries management
exports.getEnquiries = async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find().sort('-createdAt');
    res.status(200).json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    next(error);
  }
};

exports.createEnquiry = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};

    const trimmedName = String(name ?? '').trim();
    const trimmedEmail = String(email ?? '').trim().toLowerCase();
    const trimmedPhone = String(phone ?? '').trim();
    const trimmedSubject = String(subject ?? '').trim();
    const trimmedMessage = String(message ?? '').trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and message are required fields.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const enquiry = await Enquiry.create({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      subject: trimmedSubject || 'General Enquiry',
      message: trimmedMessage
    });
    res.status(201).json({ success: true, message: 'Enquiry submitted successfully', enquiry });
  } catch (error) {
    next(error);
  }
};

exports.updateEnquiryStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['unread', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid enquiry status.' });
    }
    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }
    res.status(200).json({ success: true, message: 'Enquiry status updated', enquiry });
  } catch (error) {
    next(error);
  }
};

// @desc Permanently delete a single enquiry record (Admin).
// Only the selected Enquiry document is removed. If it was unread, the sidebar
// unread badge naturally drops on the next counts fetch; read/replied counts
// and all other enquiries are untouched.
// @route DELETE /api/v1/admin/enquiries/:id
exports.deleteEnquiry = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid enquiry id.' });
    }

    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Enquiry deleted permanently.',
      deletedEnquiry: { _id: enquiry._id, name: enquiry.name, subject: enquiry.subject, status: enquiry.status }
    });
  } catch (error) {
    next(error);
  }
};

// Audit logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find()
      .populate('performedBy', 'name email role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await AuditLog.countDocuments();

    res.status(200).json({
      success: true,
      logs,
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

// All payments for Admin
exports.getAllPayments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const payments = await Payment.find()
      .populate('student', 'name email')
      .populate('course', 'title thumbnail price')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments();

    res.status(200).json({
      success: true,
      payments,
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

// =========================================================================
// SIDEBAR NOTIFICATION COUNTS (WhatsApp-style unread badges)
// Read/unread tracking is independent of the enrollment approval workflow
// and the enquiry reply status. Nothing here deletes records or auto-approves.
// =========================================================================

// Unread enrollment notifications = pending requests the admin has not seen.
const unreadEnrollmentFilter = { status: 'pending_approval', notificationViewed: { $ne: true } };
// Unread enquiry notifications = freshly submitted, never-opened enquiries.
const unreadEnquiryFilter = { status: 'unread' };
// Unread course reviews = submitted student reviews awaiting admin review
const unreadReviewFilter = { isRead: false, status: 'pending' };

// @desc Get unread notification counts for the admin sidebar
// @route GET /api/v1/admin/notifications/counts
exports.getNotificationCounts = async (req, res, next) => {
  try {
    const Review = require('../models/Review');
    const [enrollments, enquiries, reviews] = await Promise.all([
      Enrollment.countDocuments(unreadEnrollmentFilter),
      Enquiry.countDocuments(unreadEnquiryFilter),
      Review.countDocuments(unreadReviewFilter)
    ]);
    res.status(200).json({
      success: true,
      counts: { enrollments, enquiries, reviews }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark all current unread enrollment notifications as read.
// Only flags them viewed; it never approves, rejects, or deletes anything.
// @route POST /api/v1/admin/notifications/enrollments/read
exports.markEnrollmentsRead = async (req, res, next) => {
  try {
    const result = await Enrollment.updateMany(unreadEnrollmentFilter, {
      $set: { notificationViewed: true, notificationViewedAt: new Date() }
    });
    res.status(200).json({
      success: true,
      message: 'Enrollment notifications marked as read',
      updated: result.modifiedCount || 0
    });
  } catch (error) {
    next(error);
  }
};

// @desc Mark all current unread enquiries as read (leaves 'replied' untouched).
// @route POST /api/v1/admin/notifications/enquiries/read
exports.markEnquiriesRead = async (req, res, next) => {
  try {
    const result = await Enquiry.updateMany(unreadEnquiryFilter, {
      $set: { status: 'read' }
    });
    res.status(200).json({
      success: true,
      message: 'Enquiry notifications marked as read',
      updated: result.modifiedCount || 0
    });
  } catch (error) {
    next(error);
  }
};
