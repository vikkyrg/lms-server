const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const {
  getPublicVideoTestimonials,
  getAdminVideoTestimonials,
  getVideoTestimonialById,
  streamVideo,
  getThumbnail,
  createVideoTestimonial,
  updateVideoTestimonial,
  deleteVideoTestimonial
} = require('../controllers/videoTestimonialController');
const { protect, authorize } = require('../middleware/auth');

// Multer temporary storage for uploading to MongoDB GridFS / Buffer
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
        cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed for thumbnails'));
      }
    }
  }
});

const uploadFields = upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'thumbnailFile', maxCount: 1 }
]);

// Public endpoints
router.get('/', getPublicVideoTestimonials);
router.get('/:id/video', streamVideo);
router.get('/:id/stream', streamVideo);
router.get('/:id/thumbnail', getThumbnail);

// Admin endpoints
router.get('/admin', protect, authorize('admin'), getAdminVideoTestimonials);
router.get('/admin/:id', protect, authorize('admin'), getVideoTestimonialById);
router.post('/', protect, authorize('admin'), uploadFields, createVideoTestimonial);
router.put('/:id', protect, authorize('admin'), uploadFields, updateVideoTestimonial);
router.delete('/:id', protect, authorize('admin'), deleteVideoTestimonial);

module.exports = router;
