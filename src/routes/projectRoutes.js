const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getPublicProjects,
  getProjectBySlug,
  getAdminProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

// Multer storage for project thumbnails
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
    const unique = `project-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
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

// Admin endpoints (registered before /:slug so /admin is not treated as a slug parameter)
router.get('/admin/all', protect, authorize('admin'), getAdminProjects);
router.get('/admin', protect, authorize('admin'), getAdminProjects);
router.get('/admin/:id', protect, authorize('admin'), getProjectById);
router.post('/admin', protect, authorize('admin'), upload.single('imageFile'), createProject);
router.put('/admin/:id', protect, authorize('admin'), upload.single('imageFile'), updateProject);
router.patch('/admin/:id/status', protect, authorize('admin'), updateProjectStatus);
router.delete('/admin/:id', protect, authorize('admin'), deleteProject);

router.post('/', protect, authorize('admin'), upload.single('imageFile'), createProject);
router.put('/:id', protect, authorize('admin'), upload.single('imageFile'), updateProject);
router.patch('/:id/status', protect, authorize('admin'), updateProjectStatus);
router.delete('/:id', protect, authorize('admin'), deleteProject);

// Public endpoints
router.get('/', getPublicProjects);
router.get('/:slug', getProjectBySlug);

module.exports = router;

