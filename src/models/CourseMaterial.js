const mongoose = require('mongoose');

/**
 * Course Material Schema for AutoOps School LMS
 * Stores PDFs, notes, documents, and reference resources uploaded dynamically by Admin.
 */
const courseMaterialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide material title'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  module: {
    type: String, // Module name or identifier
    trim: true,
    default: ''
  },
  lesson: {
    type: String, // Lesson name or identifier
    trim: true,
    default: ''
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // in bytes
    default: 0
  },
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

courseMaterialSchema.index({ course: 1, isPublished: 1 });

module.exports = mongoose.model('CourseMaterial', courseMaterialSchema);
