const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getPublicTestimonials,
  getAdminTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial
} = require('../controllers/testimonialController');
const { protect, authorize } = require('../middleware/auth');

// Setup multer storage for testimonial avatars (stored in uploads/thumbnails)
const uploadDir = path.join(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
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

// Public route for homepage
router.get('/', getPublicTestimonials);

// Admin protected routes
router.get('/admin', protect, authorize('admin'), getAdminTestimonials);
router.get('/admin/:id', protect, authorize('admin'), getTestimonialById);
router.post('/', protect, authorize('admin'), upload.single('imageFile'), createTestimonial);
router.put('/:id', protect, authorize('admin'), upload.single('imageFile'), updateTestimonial);
router.delete('/:id', protect, authorize('admin'), deleteTestimonial);

module.exports = router;

