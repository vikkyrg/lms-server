const mongoose = require('mongoose');

/**
 * Quiz schema for AutoOps School LMS.
 *
 * Each question stores its type, options, correct answer value(s), marks and
 * an explanation. correctAnswer is NEVER sent to a student before the point
 * their answer is evaluated (controllers strip it per quiz feedback mode).
 *
 * feedbackMode:
 * - 'immediate' (Practice Mode): correctness feedback + explanation is
 *   returned as soon as the student checks an individual answer.
 * - 'deferred' (Assessment Mode): feedback and correct answers are only
 *   revealed after the final submission.
 */
const quizQuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'multiple-select', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  },
  options: [{
    type: String
  }],
  // Single choice / true-false: index of the correct option (number).
  // Multiple select: array of correct option indexes.
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  explanation: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
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
  instructions: {
    type: String,
    default: ''
  },
  timeLimitMinutes: {
    type: Number,
    default: 15,
    min: 0 // 0 = untimed
  },
  passingPercentage: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  feedbackMode: {
    type: String,
    enum: ['immediate', 'deferred'],
    default: 'deferred'
  },
  questions: [quizQuestionSchema],
  maxAttempts: {
    type: Number,
    default: 0,
    min: 0 // 0 = unlimited
  },
  deadline: Date,
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

// Total marks across all questions, computed server-side.
quizSchema.methods.totalMarks = function totalMarks() {
  return (this.questions || []).reduce((sum, q) => sum + (q.points || 1), 0);
};

module.exports = mongoose.model('Quiz', quizSchema);
