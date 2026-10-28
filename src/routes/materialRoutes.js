const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const {
  uploadMaterial,
  getMaterialsByCourse,
  downloadMaterial,
  deleteMaterial,
  updateMaterial
} = require('../controllers/materialController');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration with safe unique filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeBase}_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
  }
});

// File filter: Allow PDF documents primarily, as well as documents/notes
const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and learning document formats (.pdf, .doc, .docx, .txt, .zip) are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter
});

// Admin routes: Upload, replace, update, delete
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadMaterial);
router.put('/:id/replace', protect, authorize('admin'), upload.single('file'), uploadMaterial);
router.put('/:id', protect, authorize('admin'), updateMaterial);
router.delete('/:id', protect, authorize('admin'), deleteMaterial);

// Public / Student course materials list (Includes preview list for visitors and authenticated students)
router.get('/course/:courseId', getMaterialsByCourse);

// Protected download/view route (Checks approved enrollment and active 3-month access)
router.get('/:id/download', downloadMaterial);

module.exports = router;

