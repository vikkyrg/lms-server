const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateNumber: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  verificationUrl: {
    type: String
  },
  pdfUrl: {
    type: String
  }
}, {
  timestamps: true
});

certificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
