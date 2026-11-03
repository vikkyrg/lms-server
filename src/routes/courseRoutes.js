const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const { getCourses, getCourseDetails, createCourse, updateCourse, deleteCourse, getAdminCourses } = require('../controllers/courseController');
const { uploadCourseThumbnail, getCourseThumbnail, deleteCourseThumbnail } = require('../controllers/courseImageController');
const { getCourseReviews, createReview, updateReview, deleteReview } = require('../controllers/reviewController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

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

// Multer temporary storage for video review uploads
const reviewUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'videoFile') {
      const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (allowedVideos.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only MP4, WebM, and MOV video files are supported'));
      }
    } else {
      const allowedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedImages.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed'));
      }
    }
  }
});

const reviewUploadFields = reviewUpload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'thumbnailFile', maxCount: 1 },
  { name: 'avatarFile', maxCount: 1 }
]);

router.get('/', getCourses);
// Registered before '/:identifier' so the admin directory is not treated as a slug.
router.get('/admin/list', protect, authorize('admin'), getAdminCourses);

// Thumbnail endpoints
router.get('/thumbnail/:idOrCourseId', getCourseThumbnail);
router.post('/thumbnail/upload', protect, authorize('admin'), memoryUpload.single('thumbnail'), uploadCourseThumbnail);
router.delete('/thumbnail/:idOrCourseId', protect, authorize('admin'), deleteCourseThumbnail);

// Course Reviews Sub-endpoints
router.get('/:courseId/reviews', getCourseReviews);
// Allow both website users (with optionalAuth) and admins to submit reviews for a course
router.post('/:courseId/reviews', optionalAuth, reviewUploadFields, createReview);
router.put('/:courseId/reviews/:id', protect, authorize('admin'), reviewUploadFields, updateReview);
router.delete('/:courseId/reviews/:id', protect, authorize('admin'), deleteReview);

router.get('/:identifier', optionalAuth, getCourseDetails);
router.post('/', protect, authorize('admin'), createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

module.exports = router;
