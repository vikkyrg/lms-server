const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return process.env.JWT_SECRET;
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!['student', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'This account role is no longer supported' });
    }
    if (!req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const protectMedia = (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return protect(req, res, next);
};

const isCourseOwnerOrAdmin = async (req, courseId) => {
  const Course = require('../models/Course');
  const course = await Course.findById(courseId).select('instructor');
  if (!course) return { course: null, allowed: false };
  const allowed = req.user.role === 'admin';
  return { course, allowed };
};

const requireCourseEnrollment = async (req, courseId) => {
  const Enrollment = require('../models/Enrollment');
  const { isEnrollmentActive } = require('../utils/accessDuration');
  const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
  // Approved (or completed) and still inside the 3-month access window: the same
  // rule every other protected route uses. 'pending_approval', 'rejected' and
  // 'expired' all resolve to null here.
  return isEnrollmentActive(enrollment) ? enrollment : null;
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'unauthenticated'}' is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = { protect, protectMedia, authorize, getJwtSecret, isCourseOwnerOrAdmin, requireCourseEnrollment };
