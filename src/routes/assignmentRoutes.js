const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const {
  getAssignmentsByCourse,
  getMyCourseAssignments,
  getAssignment,
  getMyAssignmentSubmission,
  saveDraft,
  submitAssignment,
  getMySubmissions,
  downloadSubmissionFile,
  downloadAssignmentFile,
  adminListAssignments,
  adminGetAssignment,
  createAssignment,
  updateAssignment,
  setAssignmentPublish,
  deleteAssignment,
  getAllSubmissions,
  gradeSubmission
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');

// ---- Admin resource storage (reference PDF / starter files) ----
const resourcesDir = path.join(__dirname, '../../uploads/assignment-resources');
if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });

const safeName = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
};

const resourceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, resourcesDir),
  filename: (_req, file, cb) => cb(null, safeName(file))
});

const adminResourceUpload = multer({
  storage: resourceStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.doc', '.docx', '.txt', '.zip', '.png', '.jpg', '.jpeg'].includes(ext)) {
      return cb(null, true);
    }
    const error = new Error('Reference/starter files must be a document, image or zip archive');
    error.statusCode = 400;
    cb(error);
  }
});

// ---- Student submission storage (limits come from the assignment) ----
const submissionsDir = path.join(__dirname, '../../uploads/assignment-submissions');
if (!fs.existsSync(submissionsDir)) fs.mkdirSync(submissionsDir, { recursive: true });

const submissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, submissionsDir),
  filename: (_req, file, cb) => cb(null, safeName(file))
});

// Resolve the target assignment first so its allowedFileTypes / maxFileSizeMb
// can drive the multer limits, then run the upload.
const submissionUpload = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const allowed = (assignment.allowedFileTypes || []).map((e) => e.toLowerCase());
    const maxBytes = (assignment.maxFileSizeMb || 25) * 1024 * 1024;

    const upload = multer({
      storage: submissionStorage,
      limits: { fileSize: maxBytes, files: 1 },
      fileFilter: (_r, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.length === 0 || allowed.includes(ext)) return cb(null, true);
        const error = new Error(`This assignment only allows these file types: ${allowed.join(', ')}`);
        error.statusCode = 400;
        cb(error);
      }
    }).single('file');

    upload(req, res, (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds the ${assignment.maxFileSizeMb || 25} MB limit for this assignment`
          : err.message;
        return res.status(err.statusCode || 400).json({ success: false, message });
      }
      next();
    });
  } catch (error) {
    next(error);
  }
};

const multipartBody = (req, res, next) => {
  // Normalize multer text fields (they arrive as strings on req.body already).
  next();
};

// ================= Admin builder =================
router.get('/admin/list', protect, authorize('admin'), adminListAssignments);
router.get('/admin/:id', protect, authorize('admin'), adminGetAssignment);
router.post('/admin', protect, authorize('admin'), adminResourceUpload.any(['referenceFile', 'starterFiles']), multipartBody, createAssignment);
router.put('/admin/:id', protect, authorize('admin'), adminResourceUpload.any(['referenceFile', 'starterFiles']), multipartBody, updateAssignment);
router.patch('/admin/:id/publish', protect, authorize('admin'), setAssignmentPublish);
router.patch('/admin/:id/unpublish', protect, authorize('admin'), setAssignmentPublish);
router.delete('/admin/:id', protect, authorize('admin'), deleteAssignment);

// ================= Grading =================
router.get('/submissions/all', protect, authorize('admin'), getAllSubmissions);
router.put('/submissions/:id/grade', protect, authorize('admin'), gradeSubmission);
router.get('/submissions/my', protect, getMySubmissions);
router.get('/submissions/:id/download', protect, downloadSubmissionFile);

// ================= Student course-facing =================
router.get('/course/:courseId', protect, getAssignmentsByCourse);
router.get('/course/:courseId/my', protect, getMyCourseAssignments);
router.get('/:id/my-submission', protect, getMyAssignmentSubmission);
router.get('/:id/reference-file', protect, downloadAssignmentFile);
router.get('/:id/starter-file/:index', protect, downloadAssignmentFile);
router.post('/:id/draft', protect, submissionUpload, saveDraft);
router.post('/:id/submit', protect, submissionUpload, submitAssignment);
router.get('/:id', protect, getAssignment);

// Legacy admin create (JSON body) kept for compatibility
router.post('/', protect, authorize('admin'), createAssignment);

module.exports = router;
