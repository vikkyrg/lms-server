const express = require('express');
const router = express.Router();
const {
  enrollFree,
  enrollPaid,
  getMyEnrollments,
  checkEnrollment,
  getClassroom,
  saveVideoProgress,
  completeLesson,
  getAdminEnrollments,
  approveEnrollment,
  rejectEnrollment,
  deleteEnrollment
} = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/auth');

// Student routes
router.post('/free', protect, enrollFree);
router.post('/paid', protect, enrollPaid);
router.get('/my', protect, getMyEnrollments);
router.get('/check/:courseId', protect, checkEnrollment);
router.get('/classroom/:courseId', protect, getClassroom);
router.post('/video-progress', protect, saveVideoProgress);
router.post('/complete-lesson', protect, completeLesson);

// Admin-only enrollment approval and lifecycle management
router.get('/admin/list', protect, authorize('admin'), getAdminEnrollments);
router.put('/admin/:id/approve', protect, authorize('admin'), approveEnrollment);
router.put('/admin/:id/reject', protect, authorize('admin'), rejectEnrollment);
router.delete('/admin/:id', protect, authorize('admin'), deleteEnrollment);

module.exports = router;
