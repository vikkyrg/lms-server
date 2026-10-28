const express = require('express');
const router = express.Router();
const { getCourses, getCourseDetails, createCourse, updateCourse, deleteCourse, getAdminCourses } = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getCourses);
// Registered before '/:identifier' so the admin directory is not treated as a slug.
router.get('/admin/list', protect, authorize('admin'), getAdminCourses);
router.get('/:identifier', getCourseDetails);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

module.exports = router;
