const mongoose = require('mongoose');

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
  submissionText: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'resubmission_required'],
    default: 'submitted'
  },
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema);

