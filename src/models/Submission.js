const mongoose = require('mongoose');

/**
 * Assignment submission schema.
 *
 * Statuses:
 * - draft: saved by the student, not yet sent for grading.
 * - submitted: sent for grading on/before the due date.
 * - late: sent after the due date (when late submission is allowed).
 * - under_review: opened/being reviewed by an admin or trainer.
 * - graded: marks + feedback assigned.
 * - returned_for_revision: sent back to the student with feedback.
 * (legacy 'resubmission_required' remains readable for old records.)
 */
const gradingEventSchema = new mongoose.Schema({
  marksObtained: Number,
  feedback: String,
  status: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedAt: {
    type: Date,
    default: Date.now
  }
});

const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionType: {
    type: String,
    enum: ['text', 'file', 'github', 'live-url'],
    default: 'text'
  },
  submissionText: {
    type: String,
    default: ''
  },
  githubUrl: {
    type: String,
    default: ''
  },
  liveUrl: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  mimeType: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'late', 'under_review', 'graded', 'returned_for_revision', 'resubmission_required'],
    default: 'submitted'
  },
  submissionNumber: {
    type: Number,
    default: 1
  },
  submittedAt: Date,
  marksObtained: {
    type: Number
  },
  feedback: {
    type: String,
    default: ''
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  gradingHistory: [gradingEventSchema]
}, {
  timestamps: true
});

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
