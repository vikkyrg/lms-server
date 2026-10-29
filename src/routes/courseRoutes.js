const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getCourses, getCourseDetails, createCourse, updateCourse, deleteCourse, getAdminCourses } = require('../controllers/courseController');
const { uploadCourseThumbnail, getCourseThumbnail, deleteCourseThumbnail } = require('../controllers/courseImageController');
const { protect, authorize } = require('../middleware/auth');

// Memory storage for direct MongoDB binary image storage (up to 5MB)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed'));
    }
  }
});

router.get('/', getCourses);
// Registered before '/:identifier' so the admin directory is not treated as a slug.
router.get('/admin/list', protect, authorize('admin'), getAdminCourses);

// Thumbnail endpoints
router.get('/thumbnail/:idOrCourseId', getCourseThumbnail);
router.post('/thumbnail/upload', protect, authorize('admin'), memoryUpload.single('thumbnail'), uploadCourseThumbnail);
router.delete('/thumbnail/:idOrCourseId', protect, authorize('admin'), deleteCourseThumbnail);

router.get('/:identifier', getCourseDetails);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

module.exports = router;
