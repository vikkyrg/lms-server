const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getModulesByCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson
  ,uploadLessonVideo
  ,deleteLessonVideo
  ,streamLessonVideo
} = require('../controllers/curriculumController');
const { protect, protectMedia, authorize } = require('../middleware/auth');

const videoDir = path.join(__dirname, '../../uploads/tmp-videos');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, videoDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      cb(null, `${Date.now()}_${safeName}${ext}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['video/mp4', 'video/webm'].includes(file.mimetype)) return cb(null, true);
    const error = new Error('Only MP4 and WebM video files are supported');
    error.statusCode = 400;
    cb(error);
  }
});

// Admin curriculum management view (returns full lesson data incl. videoUrl/resources).
router.get('/courses/:courseId/curriculum', protect, authorize('admin'), getModulesByCourse);

router.post('/modules', protect, authorize('admin'), createModule);
router.put('/modules/:id', protect, authorize('admin'), updateModule);
router.delete('/modules/:id', protect, authorize('admin'), deleteModule);

router.post('/lessons', protect, authorize('admin'), createLesson);
router.put('/lessons/:id', protect, authorize('admin'), updateLesson);
router.delete('/lessons/:id', protect, authorize('admin'), deleteLesson);
router.post('/courses/:courseId/modules/:moduleId/lessons/:id/video', protect, authorize('admin'), videoUpload.single('video'), uploadLessonVideo);
router.delete('/courses/:courseId/modules/:moduleId/lessons/:id/video', protect, authorize('admin'), deleteLessonVideo);
router.get('/courses/:courseId/lessons/:lessonId/video', protectMedia, streamLessonVideo);

module.exports = router;
