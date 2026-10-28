const express = require('express');
const router = express.Router();
const { getQuizzesByCourse, getQuiz, createQuiz, submitQuiz, getMyAttempts } = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/auth');

router.get('/course/:courseId', protect, getQuizzesByCourse);
router.get('/attempts/my', protect, getMyAttempts);
router.get('/:id', protect, getQuiz);
router.post('/', protect, authorize('admin'), createQuiz);
router.post('/:id/submit', protect, submitQuiz);

module.exports = router;
