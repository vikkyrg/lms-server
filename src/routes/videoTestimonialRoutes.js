const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getPublicVideoTestimonials,
  getAdminVideoTestimonials,
  getVideoTestimonialById,
  createVideoTestimonial,
  updateVideoTestimonial,
  deleteVideoTestimonial
} = require('../controllers/videoTestimonialController');
const { protect, authorize } = require('../middleware/auth');

// Setup upload folders
const videoDir = path.join(__dirname, '../../uploads/videos');
const thumbDir = path.join(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'videoFile') {
      cb(null, videoDir);
    } else {
      cb(null, thumbDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'videoFile' ? 'video' : 'thumb';
    const unique = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB for uploaded videos, thumbnails much smaller
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
      if (allowedImages.includes(file.mimetype)) {
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

// Public endpoint for homepage
router.get('/', getPublicVideoTestimonials);

// Admin endpoints
router.get('/admin', protect, authorize('admin'), getAdminVideoTestimonials);
router.get('/admin/:id', protect, authorize('admin'), getVideoTestimonialById);
router.post('/', protect, authorize('admin'), uploadFields, createVideoTestimonial);
router.put('/:id', protect, authorize('admin'), uploadFields, updateVideoTestimonial);
router.delete('/:id', protect, authorize('admin'), deleteVideoTestimonial);

module.exports = router;

