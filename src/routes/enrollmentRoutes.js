const express = require('express');
const router = express.Router();
const {
  enrollFree,
  getMyEnrollments,
  checkEnrollment,
  getClassroom,
  completeLesson,
  getAdminEnrollments,
  approveEnrollment,
  rejectEnrollment
} = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/auth');

// Student routes
router.post('/free', protect, enrollFree);
router.get('/my', protect, getMyEnrollments);
router.get('/check/:courseId', protect, checkEnrollment);
router.get('/classroom/:courseId', protect, getClassroom);
router.post('/complete-lesson', protect, completeLesson);

// Admin-only enrollment approval and lifecycle management
router.get('/admin/list', protect, authorize('admin'), getAdminEnrollments);
router.put('/admin/:id/approve', protect, authorize('admin'), approveEnrollment);
router.put('/admin/:id/reject', protect, authorize('admin'), rejectEnrollment);

module.exports = router;
