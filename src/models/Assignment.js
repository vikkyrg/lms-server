const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
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
  instructions: {
    type: String,
    required: true
  },
  totalMarks: {
    type: Number,
    default: 100
  },
  dueDate: {
    type: Date,
    required: true
  },
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Assignment', assignmentSchema);
