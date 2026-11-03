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
    const { status, search } = req.query;
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
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    const skip = (page - 1) * limit;
    const rawStudents = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);

    // Aggregate enrollment counts for these students
    const studentIds = rawStudents.map(s => s._id);
    const enrollmentCounts = await Enrollment.aggregate([
      { $match: { student: { $in: studentIds } } },
      { $group: { _id: '$student', count: { $sum: 1 } } }
    ]);
    const enrollmentCountMap = new Map(enrollmentCounts.map(item => [item._id.toString(), item.count]));

    const users = rawStudents.map(s => ({
      ...s,
      enrolledCoursesCount: enrollmentCountMap.get(s._id.toString()) || 0
    }));

    res.status(200).json({
      success: true,
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

    const [enrollments, certificates] = await Promise.all([
      Enrollment.find({ student: student._id })
        .populate('course', 'title thumbnail shortDescription duration slug price discountPrice isFree')
        .populate('payment', 'amount currency status orderId paymentId createdAt')
        .sort('-createdAt')
        .lean(),
      require('../models/Certificate').find({ studentId: student._id })
        .populate('courseId', 'title thumbnail')
        .sort('-issueDate')
        .lean()
    ]);

    res.status(200).json({
      success: true,
      student,
      enrollments,
      certificates
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  return res.status(403).json({
    success: false,
    message: 'Role modification and user deactivation through the Student Directory has been disabled for security.'
  });
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

// @desc Get unread notification counts for the admin sidebar
// @route GET /api/v1/admin/notifications/counts
exports.getNotificationCounts = async (req, res, next) => {
  try {
    const [enrollments, enquiries] = await Promise.all([
      Enrollment.countDocuments(unreadEnrollmentFilter),
      Enquiry.countDocuments(unreadEnquiryFilter)
    ]);
    res.status(200).json({
      success: true,
      counts: { enrollments, enquiries }
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
