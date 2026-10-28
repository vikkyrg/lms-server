const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Submission = require('../models/Submission');
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
    const pendingGrading = await Submission.countDocuments({ status: 'submitted' });

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
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
        pendingGrading
      },
      recentStudents,
      recentPayments,
      topCourses
    });
  } catch (error) {
    next(error);
  }
};

// Users management
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { role: { $in: ['student', 'admin'] } };
    if (role) {
      if (!['student', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Unsupported user role' });
      }
      query.role = role;
    }
    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const users = await User.find(query).sort('-createdAt').skip(skip).limit(Number(limit));
    const total = await User.countDocuments(query);

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

exports.updateUserStatus = async (req, res, next) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const { isActive, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot modify your own account role or status' });
    }

    if (isActive !== undefined && typeof isActive === 'boolean') user.isActive = isActive;
    if (role && ['student', 'admin'].includes(role)) user.role = role;

    await user.save();

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'USER_UPDATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'User',
      targetId: user._id,
      details: { updatedFields: { isActive, role } }
    });

    res.status(200).json({ success: true, user });
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
    const { name, email, subject, message } = req.body;
    const enquiry = await Enquiry.create({ name, email, subject, message });
    res.status(201).json({ success: true, message: 'Enquiry submitted successfully', enquiry });
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
