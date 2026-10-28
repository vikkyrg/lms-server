const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide lesson title'],
    trim: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: ''
  },
  video: {
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    storageKey: { type: String, default: '' },
    originalName: { type: String, default: '' },
    contentType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: Date
  },
  duration: {
    type: Number, // in minutes or seconds
    default: 0
  },
  order: {
    type: Number,
    default: 1
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  resources: [{
    title: String,
    fileUrl: String,
    fileType: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Lesson', lessonSchema);
