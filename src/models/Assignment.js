const mongoose = require('mongoose');

/**
 * Assignment / real-world project schema.
 *
 * An assignment is tied to a course and optionally to a module and lesson.
 * submissionTypes drives what the student may submit: text, file, a GitHub
 * repository URL, a live project URL, or any combination the admin enables.
 */
const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: ''
  },
  learningObjectives: [{
    type: String,
    trim: true
  }],
  isProject: {
    type: Boolean,
    default: false
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module'
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  submissionTypes: [{
    type: String,
    enum: ['text', 'file', 'github', 'live-url'],
    default: 'text'
  }],
  allowedFileTypes: [{
    type: String
  }], // e.g. ['.pdf', '.zip']
  maxFileSizeMb: {
    type: Number,
    default: 25
  },
  dueDate: {
    type: Date,
    required: true
  },
  totalMarks: {
    type: Number,
    default: 100
  },
  passingMarks: {
    type: Number,
    default: 40
  },
  rubric: {
    type: String,
    default: ''
  },
  referenceFile: {
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: '' }
  },
  starterFiles: [{
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String
  }],
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  allowResubmission: {
    type: String,
    enum: ['never', 'before-grading', 'after-revision'],
    default: 'before-grading'
  },
  order: {
    type: Number,
    default: 1
  },
  published: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Assignment', assignmentSchema);
