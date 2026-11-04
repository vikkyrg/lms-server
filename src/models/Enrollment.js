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
  // Paid course enrollment attributes
  coursePrice: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['free', 'pending_verification', 'verified', 'completed', 'failed', 'refunded'],
    default: 'free'
  },
  transactionReference: {
    type: String,
    default: '',
    trim: true
  },
  progress: {
    type: Number,
    default: 0 // percentage 0 - 100
  },
  completedLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  lessonProgress: [{
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true
    },
    playbackPosition: {
      type: Number,
      default: 0
    },
    secondsWatched: {
      type: Number,
      default: 0
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
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
  },
  // Admin sidebar notification read/unread tracking. Independent from the
  // approval workflow: marking a notification as "read" only means the admin
  // has opened Approvals & Access since this request arrived. It never changes
  // the enrollment status or grant/revoke access.
  notificationViewed: {
    type: Boolean,
    default: false
  },
  notificationViewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
