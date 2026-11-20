const express = require('express');
const multer = require('multer');
const {
  getAdminPopup,
  saveAdminPopup,
  toggleAdminPopup,
  deleteAdminPopup,
  getPopupImage
} = require('../controllers/websitePopupController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(null, true);
    }
    const error = new Error('Only JPEG, PNG, and WebP images are allowed');
    error.statusCode = 400;
    return callback(error);
  }
});

router.use(protect, authorize('admin'));
router.get('/', getAdminPopup);
router.get('/image', getPopupImage);
router.post('/', upload.single('image'), saveAdminPopup);
router.put('/', upload.single('image'), saveAdminPopup);
router.patch('/toggle', toggleAdminPopup);
router.delete('/', deleteAdminPopup);

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false,
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Popup image must be 3 MB or smaller'
        : error.message
    });
  }
  if (error.statusCode === 400) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return next(error);
});

module.exports = router;
