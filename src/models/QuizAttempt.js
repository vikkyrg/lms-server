const mongoose = require('mongoose');

/**
 * One attempt of a quiz by one student.
 *
 * Lifecycle: 'in_progress' (created on Start) -> 'completed' (final submit).
 * Answers are persisted progressively via /answer so a refresh does not lose
 * work and a duplicate submit finalizes the same attempt instead of
 * creating a second one.
 */
const quizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
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
  attemptNumber: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  timeSpentSeconds: Number,
  score: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  answers: [{
    questionIndex: Number,
    // String for single choice / true-false / short answer, array for multi-select
    userAnswer: {
      type: mongoose.Schema.Types.Mixed
    },
    isCorrect: Boolean,
    marksEarned: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

quizAttemptSchema.index({ quizId: 1, studentId: 1, status: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
