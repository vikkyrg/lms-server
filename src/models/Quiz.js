const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
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
    default: ''
  },
  timeLimitMinutes: {
    type: Number,
    default: 15
  },
  passingPercentage: {
    type: Number,
    default: 70
  },
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'multiple-select', 'true-false', 'short-answer'],
      default: 'multiple-choice'
    },
    options: [{
      type: String
    }],
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    explanation: String,
    points: {
      type: Number,
      default: 1
    }
  }]
  ,
  maxAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  deadline: Date,
  published: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quiz', quizSchema);
