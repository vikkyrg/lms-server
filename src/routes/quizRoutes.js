const express = require('express');
const router = express.Router();
const {
  getQuizzesByCourse,
  getMyCourseQuizzes,
  getQuiz,
  startQuiz,
  saveAnswer,
  checkAnswer,
  submitQuiz,
  getAttemptResult,
  getQuizAttempts,
  getMyAttempts,
  createQuiz,
  adminListQuizzes,
  adminGetQuiz,
  updateQuiz,
  publishQuiz,
  unpublishQuiz,
  reorderQuizzes,
  deleteQuiz
} = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/auth');

// Admin quiz builder (must be mounted before the parameterized /:id routes)
router.get('/admin/quizzes', protect, authorize('admin'), adminListQuizzes);
router.get('/admin/quizzes/:id', protect, authorize('admin'), adminGetQuiz);
router.post('/admin/quizzes', protect, authorize('admin'), createQuiz);
router.put('/admin/quizzes/:id', protect, authorize('admin'), updateQuiz);
router.patch('/admin/quizzes/:id/publish', protect, authorize('admin'), publishQuiz);
router.patch('/admin/quizzes/:id/unpublish', protect, authorize('admin'), unpublishQuiz);
router.put('/admin/reorder', protect, authorize('admin'), reorderQuizzes);
router.delete('/admin/quizzes/:id', protect, authorize('admin'), deleteQuiz);
// Legacy admin create path (kept for backward compatibility)
router.post('/', protect, authorize('admin'), createQuiz);

// Student-facing
router.get('/attempts/my', protect, getMyAttempts);
router.get('/course/:courseId', protect, getQuizzesByCourse);
router.get('/course/:courseId/my', protect, getMyCourseQuizzes);
router.get('/:id/attempts', protect, getQuizAttempts);
router.get('/:id/attempt/:attemptId/result', protect, getAttemptResult);
router.get('/:id', protect, getQuiz);
router.post('/:id/start', protect, startQuiz);
router.put('/:id/attempt/:attemptId/answer', protect, saveAnswer);
router.post('/:id/attempt/:attemptId/check', protect, checkAnswer);
router.post('/:id/attempt/:attemptId/submit', protect, submitQuiz);
// Legacy submit path (creates + scores in one call)
router.post('/:id/submit', protect, submitQuiz);

module.exports = router;
