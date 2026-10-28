const express = require('express');
const router = express.Router();
const {
  getAssignmentsByCourse,
  createAssignment,
  submitAssignment,
  getMySubmissions,
  gradeSubmission,
  getAllSubmissions
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/course/:courseId', protect, getAssignmentsByCourse);
router.post('/', protect, authorize('admin'), createAssignment);
router.post('/:id/submit', protect, submitAssignment);
router.get('/submissions/my', protect, getMySubmissions);
router.get('/submissions/all', protect, authorize('admin'), getAllSubmissions);
router.put('/submissions/:id/grade', protect, authorize('admin'), gradeSubmission);

module.exports = router;
