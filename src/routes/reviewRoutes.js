const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const {
  getCourseReviews,
  getAdminReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  streamVideo,
  getThumbnail
} = require('../controllers/reviewController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Multer temporary storage for video, thumbnail, and avatar
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for video files
  },
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

const uploadFields = upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'thumbnailFile', maxCount: 1 },
  { name: 'avatarFile', maxCount: 1 }
]);

// Public endpoints
router.get('/course/:courseId', getCourseReviews);
router.get('/:courseId/reviews', getCourseReviews);
router.get('/:id/stream', streamVideo);
router.get('/:id/thumbnail', getThumbnail);

// Admin endpoints
router.get('/admin', protect, authorize('admin'), getAdminReviews);
router.get('/admin/:id', protect, authorize('admin'), getReviewById);
// Create review endpoints (requires valid login for students/users, admin also allowed)
router.post('/course/:courseId', protect, uploadFields, createReview);
router.post('/:courseId/reviews', protect, uploadFields, createReview);
router.post('/', protect, uploadFields, createReview);
router.put('/:id', protect, authorize('admin'), uploadFields, updateReview);
router.delete('/:id', protect, authorize('admin'), deleteReview);

module.exports = router;
