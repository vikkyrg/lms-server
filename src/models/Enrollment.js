const mongoose = require('mongoose');

/**
 * Enrollment Schema for AutoOps School LMS
 * Status workflow:
 * - pending_approval: Paid via Razorpay / free request submitted, awaiting Admin review.
 * - approved: Approved by Admin. Active 3-calendar-month access period begins.
 * - rejected: Rejected by Admin (with optional reason). No course access granted.
 * - completed: Student finished 100% of curriculum and earned certificate.
 * - expired: 3-month calendar period elapsed. Content/PDF access blocked; certificates/progress preserved.
 */
const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'completed', 'expired'],
    default: 'pending_approval'
  },
  progress: {
    type: Number,
    default: 0 // percentage 0 - 100
  },
  completedLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  lastAccessedLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  accessStartDate: {
    type: Date
  },
  accessExpiryDate: {
    type: Date
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  completedAt: {
    type: Date
  },
  certificateIssued: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
