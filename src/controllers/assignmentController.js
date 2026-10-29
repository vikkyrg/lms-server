const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const { requireCourseEnrollment, isCourseOwnerOrAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const ASSIGNMENT_FIELDS = [
  'title', 'description', 'instructions', 'courseId', 'moduleId', 'lessonId',
  'dueDate', 'totalMarks', 'passingMarks', 'allowLateSubmission', 'allowResubmission',
  'published', 'order', 'isProject'
];

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const asBool = (value) => value === true || value === 'true' || value === '1';

const validateAssignmentPayload = (body) => {
  const errors = [];
  if (!String(body.title || '').trim()) errors.push('Assignment title is required.');
  if (!String(body.instructions || '').trim() && !String(body.description || '').trim()) {
    errors.push('Provide a description and/or instructions for students.');
  }
  const submissionTypes = parseJsonField(body.submissionTypes, []);
  if (submissionTypes.length === 0) errors.push('Select at least one submission type.');
  const invalidTypes = submissionTypes.filter((t) => !['text', 'file', 'github', 'live-url'].includes(t));
  if (invalidTypes.length) errors.push('Unsupported submission type selected.');
  if (body.dueDate && Number.isNaN(new Date(body.dueDate).getTime())) errors.push('Due date is invalid.');
  const totalMarks = Number(body.totalMarks);
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) errors.push('Total marks must be a positive number.');
  const passingMarks = Number(body.passingMarks ?? 0);
  if (!Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
    errors.push('Passing marks must be between 0 and total marks.');
  }
  if (body.maxFileSizeMb !== undefined && (Number(body.maxFileSizeMb) <= 0 || Number(body.maxFileSizeMb) > 50)) {
    errors.push('Max file size must be between 1 and 50 MB.');
  }
  return errors;
};

const mapAssignmentBody = (body) => {
  const fields = {};
  ASSIGNMENT_FIELDS.forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.submissionTypes !== undefined) {
    fields.submissionTypes = parseJsonField(body.submissionTypes, ['text']);
  }
  if (body.allowedFileTypes !== undefined) {
    fields.allowedFileTypes = parseJsonField(body.allowedFileTypes, [])
      .map((ext) => String(ext).trim().toLowerCase())
      .filter((ext) => /^\.[a-z0-9]+$/.test(ext));
  }
  if (body.learningObjectives !== undefined) {
    const raw = parseJsonField(body.learningObjectives, []);
    fields.learningObjectives = (Array.isArray(raw) ? raw : [])
      .map((item) => String(item).trim()).filter(Boolean);
  }
  if (body.rubric !== undefined) fields.rubric = body.rubric;
  if (body.maxFileSizeMb !== undefined) fields.maxFileSizeMb = Number(body.maxFileSizeMb) || 25;
  if (fields.published !== undefined) fields.published = asBool(fields.published);
  if (fields.allowLateSubmission !== undefined) fields.allowLateSubmission = asBool(fields.allowLateSubmission);
  if (fields.allowResubmission !== undefined && !['never', 'before-grading', 'after-revision'].includes(fields.allowResubmission)) {
    delete fields.allowResubmission;
  }
  if (fields.totalMarks !== undefined) fields.totalMarks = Number(fields.totalMarks);
  if (fields.passingMarks !== undefined) fields.passingMarks = Number(fields.passingMarks);
  if (fields.isProject !== undefined) fields.isProject = asBool(fields.isProject);
  if (fields.moduleId === '') fields.moduleId = null;
  if (fields.lessonId === '') fields.lessonId = null;
  return fields;
};

const ensureAssignmentManager = async (req, res, courseId) => {
  if (!mongoose.isValidObjectId(courseId)) {
    res.status(400).json({ success: false, message: 'Invalid course id' });
    return null;
  }
  const manager = await isCourseOwnerOrAdmin(req, courseId);
  if (!manager.allowed) {
    res.status(403).json({ success: false, message: 'You are not authorized to manage assignments for this course' });
    return null;
  }
  return manager;
};

const attachContext = async (assignments) => {
  const moduleIds = assignments.map((a) => a.moduleId).filter(Boolean);
  const lessonIds = assignments.map((a) => a.lessonId).filter(Boolean);
  const [modules, lessons] = await Promise.all([
    moduleIds.length ? Module.find({ _id: { $in: moduleIds } }).select('title order') : [],
    lessonIds.length ? Lesson.find({ _id: { $in: lessonIds } }).select('title order') : []
  ]);
  const moduleMap = new Map(modules.map((m) => [m._id.toString(), m]));
  const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));
  return assignments.map((a) => ({
    ...a,
    moduleTitle: a.moduleId ? moduleMap.get(String(a.moduleId))?.title || null : null,
    lessonTitle: a.lessonId ? lessonMap.get(String(a.lessonId))?.title || null : null
  }));
};

const toPlain = (doc) => (typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : doc);

const studentSummary = (assignment, submission) => {
  const isLate = assignment.dueDate && submission?.submittedAt
    ? new Date(submission.submittedAt) > new Date(assignment.dueDate)
    : false;
  let displayStatus = 'not-submitted';
  if (submission) {
    if (submission.status === 'draft') displayStatus = 'draft';
    else if (submission.status === 'graded') displayStatus = 'graded';
    else if (submission.status === 'returned_for_revision' || submission.status === 'resubmission_required') displayStatus = 'returned';
    else if (isLate) displayStatus = 'late';
    else if (submission.status === 'under_review') displayStatus = 'under-review';
    else displayStatus = 'submitted';
  } else if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
    displayStatus = 'missed';
  }
  return {
    hasSubmission: Boolean(submission),
    submissionId: submission?._id || null,
    submissionStatus: submission?.status || null,
    displayStatus,
    isLate,
    marksObtained: submission?.marksObtained ?? null,
    feedback: submission?.feedback || '',
    passed: submission?.marksObtained !== undefined && submission?.marksObtained !== null
      ? Number(submission.marksObtained) >= Number(assignment.passingMarks ?? 0)
      : null,
    canResubmit: (() => {
      if (!submission) {
        return !assignment.dueDate || new Date() <= new Date(assignment.dueDate) || assignment.allowLateSubmission;
      }
      if (assignment.allowResubmission === 'never') return false;
      if (assignment.allowResubmission === 'before-grading') return submission.status !== 'graded';
      if (assignment.allowResubmission === 'after-revision') {
        return ['returned_for_revision', 'resubmission_required'].includes(submission.status);
      }
      return false;
    })()
  };
};

// ============================================================
// Student-facing endpoints
// ============================================================

// GET /assignments/course/:courseId - published assignments for the classroom
exports.getAssignmentsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course id' });
    }
    const enrollment = await requireCourseEnrollment(req, courseId);
    const manager = enrollment ? { allowed: false } : await isCourseOwnerOrAdmin(req, courseId);
    if (!enrollment && !manager.allowed) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to access assignments for this course' });
    }
    const filter = { courseId };
    if (req.user.role === 'student') filter.published = true;
    const assignments = (await Assignment.find(filter).sort('order dueDate')).map(toPlain);
    res.status(200).json({ success: true, assignments: await attachContext(assignments) });
  } catch (error) {
    next(error);
  }
};

// GET /assignments/course/:courseId/my - assignments with the student status
exports.getMyCourseAssignments = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const enrollment = await requireCourseEnrollment(req, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required to access assignments' });
    }
    const assignments = await Assignment.find({ courseId, published: true }).sort('order dueDate');
    const submissions = await Submission.find({ courseId, studentId: req.user.id }).lean();
    const submissionMap = new Map(submissions.map((s) => [String(s.assignmentId), s]));
    const payloads = assignments.map((a) => {
      const plain = toPlain(a);
      return { ...plain, mySubmission: studentSummary(plain, submissionMap.get(String(a._id))) };
    });
    res.status(200).json({ success: true, assignments: await attachContext(payloads) });
  } catch (error) {
    next(error);
  }
};

// GET /assignments/:id - single assignment detail for students
exports.getAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (req.user.role === 'student') {
      const enrollment = await requireCourseEnrollment(req, assignment.courseId);
      if (!enrollment || !assignment.published) {
        return res.status(403).json({ success: false, message: 'You must be enrolled to access this assignment' });
      }
    } else if (!(await isCourseOwnerOrAdmin(req, assignment.courseId)).allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this assignment' });
    }
    const submission = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: req.user.id
    }).lean();
    const plain = toPlain(assignment);
    const [withContext] = await attachContext([plain]);
    res.status(200).json({
      success: true,
      assignment: withContext,
      mySubmission: req.user.role === 'student' ? studentSummary(plain, submission) : null
    });
  } catch (error) {
    next(error);
  }
};

// GET /assignments/:id/my-submission - the student's own submission + history
exports.getMyAssignmentSubmission = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const enrollment = await requireCourseEnrollment(req, assignment.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required' });
    }
    const submission = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: req.user.id
    })
      .populate('gradedBy', 'name')
      .lean();
    res.status(200).json({
      success: true,
      submission,
      summary: studentSummary(toPlain(assignment), submission)
    });
  } catch (error) {
    next(error);
  }
};

const buildSubmissionFromRequest = (req, assignment, { keepFile = false } = {}) => {
  const type = req.body.submissionType || 'text';
  if (!assignment.submissionTypes.includes(type)) {
    return { error: `This assignment does not accept '${type}' submissions.` };
  }
  const text = String(req.body.submissionText || '').trim();
  const githubUrl = String(req.body.githubUrl || '').trim();
  const liveUrl = String(req.body.liveUrl || '').trim();

  if (type === 'text' && !text) return { error: 'A text response is required.' };
  if (type === 'github' && !/^https?:\/\/(www\.)?github\.com\/[^\s]+$/i.test(githubUrl)) {
    return { error: 'Enter a valid GitHub repository URL (https://github.com/...).' };
  }
  if (type === 'live-url' && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(liveUrl)) {
    return { error: 'Enter a valid live project URL (https://...).' };
  }
  if (type === 'file' && !req.file && !(keepFile && req.body.hasExistingFile === 'true')) {
    return { error: 'Attach the required file for this submission.' };
  }

  const keepExisting = keepFile && !req.file && req.body.hasExistingFile === 'true';
  return {
    submissionType: type,
    submissionText: type === 'text' ? text : '',
    githubUrl,
    liveUrl,
    ...(keepExisting ? {} : {
      fileUrl: req.file ? `/uploads/assignment-submissions/${req.file.filename}` : '',
      fileName: req.file ? req.file.originalname : '',
      fileSize: req.file ? req.file.size : 0,
      mimeType: req.file ? req.file.mimetype : ''
    })
  };
};

// POST /assignments/:id/draft - save (or update) a draft without submitting
exports.saveDraft = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const enrollment = await requireCourseEnrollment(req, assignment.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required' });
    }
    if (assignment.published === false) {
      return res.status(400).json({ success: false, message: 'This assignment is not published' });
    }

    const payload = buildSubmissionFromRequest(req, assignment, { keepFile: true });
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });

    let submission = await Submission.findOne({ assignmentId: assignment._id, studentId: req.user.id });
    if (submission && submission.status === 'graded') {
      return res.status(400).json({ success: false, message: 'This submission is already graded.' });
    }
    if (submission) {
      Object.assign(submission, payload, { status: 'draft' });
      await submission.save();
    } else {
      submission = await Submission.create({
        ...payload,
        assignmentId: assignment._id,
        courseId: assignment.courseId,
        studentId: req.user.id,
        status: 'draft'
      });
    }
    res.status(200).json({ success: true, submission, summary: studentSummary(toPlain(assignment), submission) });
  } catch (error) {
    next(error);
  }
};

// POST /assignments/:id/submit - final submission for grading
exports.submitAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const enrollment = await requireCourseEnrollment(req, assignment.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required to submit this assignment' });
    }
    if (!assignment.published) {
      return res.status(400).json({ success: false, message: 'This assignment is not published' });
    }

    const payload = buildSubmissionFromRequest(req, assignment);
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });

    const pastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
    if (pastDue && !assignment.allowLateSubmission) {
      return res.status(400).json({ success: false, message: 'The assignment deadline has passed' });
    }

    let submission = await Submission.findOne({ assignmentId: assignment._id, studentId: req.user.id });
    if (submission) {
      if (submission.status === 'graded' || !studentSummary(toPlain(assignment), submission).canResubmit) {
        return res.status(400).json({
          success: false,
          message: assignment.allowResubmission === 'never'
            ? 'Resubmission is not allowed for this assignment.'
            : 'This submission cannot be resubmitted under the assignment rules.'
        });
      }
      // Replace the previous attempt's content and reset grading state.
      Object.assign(submission, payload, {
        status: pastDue ? 'late' : 'submitted',
        submissionNumber: (submission.submissionNumber || 1) + 1,
        submittedAt: new Date(),
        marksObtained: undefined,
        feedback: ''
      });
      await submission.save();
    } else {
      submission = await Submission.create({
        ...payload,
        assignmentId: assignment._id,
        courseId: assignment.courseId,
        studentId: req.user.id,
        status: pastDue ? 'late' : 'submitted',
        submittedAt: new Date()
      });
    }

    await logAudit({
      action: 'ASSIGNMENT_SUBMITTED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Submission',
      targetId: submission._id,
      details: { assignment: assignment.title, type: submission.submissionType, status: submission.status }
    });
    res.status(200).json({ success: true, submission, summary: studentSummary(toPlain(assignment), submission) });
  } catch (error) {
    next(error);
  }
};

// GET /assignments/submissions/my - submission history for the student
exports.getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ studentId: req.user.id })
      .populate('assignmentId', 'title totalMarks passingMarks dueDate published')
      .populate('courseId', 'title')
      .populate('gradedBy', 'name')
      .sort('-updatedAt');
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    next(error);
  }
};

// GET /assignments/submissions/:id/download - student's own file or grader
exports.downloadSubmissionFile = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission || !submission.fileUrl) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const isOwner = String(submission.studentId) === String(req.user.id);
    const manager = await isCourseOwnerOrAdmin(req, submission.courseId);
    if (!isOwner && !manager.allowed) {
      return res.status(403).json({ success: false, message: 'You can only access your own submissions' });
    }
    const filePath = path.join(__dirname, '../../', submission.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical file not found on server' });
    }
    res.setHeader('Content-Type', submission.mimeType || 'application/octet-stream');
    const safeName = (submission.fileName || 'submission').replace(/[^\w.-]/g, '_');
    const inline = req.query.inline === 'true';
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

// GET /assignments/:id/reference-file and /starter-file/:index - course docs
exports.downloadAssignmentFile = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (req.user.role === 'student') {
      const enrollment = await requireCourseEnrollment(req, assignment.courseId);
      if (!enrollment) {
        return res.status(403).json({ success: false, message: 'An active enrollment is required' });
      }
    } else if (!(await isCourseOwnerOrAdmin(req, assignment.courseId)).allowed) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let file;
    if (req.params.index !== undefined) {
      const idx = Number(req.params.index);
      file = (assignment.starterFiles || [])[idx];
    } else {
      file = assignment.referenceFile;
    }
    if (!file || !file.fileUrl) return res.status(404).json({ success: false, message: 'File not found' });

    const filePath = path.join(__dirname, '../../', file.fileUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Physical file not found' });
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    const safeName = (file.fileName || 'assignment-file').replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin endpoints (/assignments/admin/*)
// ============================================================

exports.adminListAssignments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.moduleId) filter.moduleId = req.query.moduleId;
    const assignments = await Assignment.find(filter).sort('order dueDate').lean();
    const ids = assignments.map((a) => a._id);
    const counts = await Submission.aggregate([
      { $match: { assignmentId: { $in: ids } } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'late', 'under_review', 'draft']] }, 1, 0] } } } }
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));
    const enriched = assignments.map((a) => ({
      ...a,
      submissionCount: countMap.get(String(a._id))?.count || 0,
      pendingGradingCount: countMap.get(String(a._id))?.pending || 0
    }));
    res.status(200).json({ success: true, assignments: await attachContext(enriched) });
  } catch (error) {
    next(error);
  }
};

exports.adminGetAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const manager = await ensureAssignmentManager(req, res, assignment.courseId);
    if (!manager) return;
    res.status(200).json({ success: true, assignment: toPlain(assignment) });
  } catch (error) {
    next(error);
  }
};

// POST /assignments/admin - create (multipart: referenceFile / starterFiles)
exports.createAssignment = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ success: false, message: 'Course is required' });
    const manager = await ensureAssignmentManager(req, res, courseId);
    if (!manager) return;

    const errors = validateAssignmentPayload(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: 'Fix the highlighted issues', errors });

    const fields = mapAssignmentBody(req.body);
    if (fields.order === undefined) {
      const count = await Assignment.countDocuments({ courseId });
      fields.order = count + 1;
    }
    const files = req.files || [];
    const reference = files.find((f) => f.fieldname === 'referenceFile');
    if (reference) {
      fields.referenceFile = {
        fileUrl: `/uploads/assignment-resources/${reference.filename}`,
        fileName: reference.originalname,
        fileSize: reference.size,
        mimeType: reference.mimetype
      };
    }
    const starters = files.filter((f) => f.fieldname === 'starterFiles');
    if (starters.length) {
      fields.starterFiles = starters.map((f) => ({
        fileUrl: `/uploads/assignment-resources/${f.filename}`,
        fileName: f.originalname,
        fileSize: f.size,
        mimeType: f.mimetype
      }));
    }

    const assignment = await Assignment.create(fields);
    await logAudit({
      action: fields.published ? 'ASSIGNMENT_PUBLISHED' : 'ASSIGNMENT_DRAFT_CREATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Assignment',
      targetId: assignment._id,
      details: { title: assignment.title, courseId }
    });
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const manager = await ensureAssignmentManager(req, res, assignment.courseId);
    if (!manager) return;

    const merged = { ...toPlain(assignment), ...req.body };
    const errors = validateAssignmentPayload(merged);
    if (errors.length) return res.status(400).json({ success: false, message: 'Fix the highlighted issues', errors });

    const fields = mapAssignmentBody(req.body);
    delete fields.courseId;
    const files = req.files || [];
    const reference = files.find((f) => f.fieldname === 'referenceFile');
    if (reference) {
      const oldPath = assignment.referenceFile?.fileUrl
        ? path.join(__dirname, '../../', assignment.referenceFile.fileUrl)
        : null;
      if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      fields.referenceFile = {
        fileUrl: `/uploads/assignment-resources/${reference.filename}`,
        fileName: reference.originalname,
        fileSize: reference.size,
        mimeType: reference.mimetype
      };
    }
    const starters = files.filter((f) => f.fieldname === 'starterFiles');
    if (starters.length) {
      fields.starterFiles = starters.map((f) => ({
        fileUrl: `/uploads/assignment-resources/${f.filename}`,
        fileName: f.originalname,
        fileSize: f.size,
        mimeType: f.mimetype
      }));
    }
    Object.assign(assignment, fields);
    await assignment.save();

    await logAudit({
      action: 'ASSIGNMENT_UPDATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Assignment',
      targetId: assignment._id,
      details: { title: assignment.title }
    });
    res.status(200).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
};

exports.setAssignmentPublish = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const manager = await ensureAssignmentManager(req, res, assignment.courseId);
    if (!manager) return;

    const publish = req.params.action === 'publish';
    if (publish) {
      const errors = validateAssignmentPayload(toPlain(assignment));
      if (errors.length) return res.status(400).json({ success: false, message: 'Assignment is not ready to publish', errors });
    }
    assignment.published = publish;
    await assignment.save();

    await logAudit({
      action: publish ? 'ASSIGNMENT_PUBLISHED' : 'ASSIGNMENT_UNPUBLISHED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Assignment',
      targetId: assignment._id,
      details: { title: assignment.title }
    });
    res.status(200).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const manager = await ensureAssignmentManager(req, res, assignment.courseId);
    if (!manager) return;

    const submissionCount = await Submission.countDocuments({ assignmentId: assignment._id });
    if (submissionCount > 0 && req.query.confirm !== 'true') {
      return res.status(409).json({
        success: false,
        code: 'ASSIGNMENT_HAS_SUBMISSIONS',
        message: `This assignment has ${submissionCount} submission(s). Deleting it also removes them.`,
        submissionCount
      });
    }

    await Submission.deleteMany({ assignmentId: assignment._id });
    await Assignment.findByIdAndDelete(assignment._id);

    for (const fileUrl of [
      assignment.referenceFile?.fileUrl,
      ...(assignment.starterFiles || []).map((f) => f.fileUrl)
    ].filter(Boolean)) {
      const abs = path.join(__dirname, '../../', fileUrl);
      if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch (e) { console.error('Assignment file cleanup failed:', e.message); }
      }
    }

    await logAudit({
      action: 'ASSIGNMENT_DELETED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Assignment',
      targetId: assignment._id,
      details: { title: assignment.title, removedSubmissions: submissionCount }
    });
    res.status(200).json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Grading endpoints
// ============================================================

// GET /assignments/submissions/all?courseId&moduleId&assignmentId&studentId&status
exports.getAllSubmissions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.assignmentId) filter.assignmentId = req.query.assignmentId;
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.moduleId) {
      const courseAssignments = await Assignment.find({ courseId: req.query.courseId || undefined, moduleId: req.query.moduleId })
        .select('_id').lean();
      filter.assignmentId = { $in: courseAssignments.map((a) => a._id) };
    }

    // Students may only ever see their own submissions.
    if (req.user.role !== 'admin') {
      filter.studentId = req.user.id;
    }

    const submissions = await Submission.find(filter)
      .populate('assignmentId', 'title totalMarks passingMarks dueDate moduleId lessonId submissionTypes')
      .populate('studentId', 'name email')
      .populate('courseId', 'title')
      .populate('gradedBy', 'name')
      .sort('-updatedAt');

    res.status(200).json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    next(error);
  }
};

// PUT /assignments/submissions/:id/grade  { marksObtained, feedback, action: 'grade' | 'return' | 'review' }
exports.gradeSubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    // Server-side authorization: managers of the course (or platform admins).
    const manager = await isCourseOwnerOrAdmin(req, submission.courseId);
    if (!manager.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to grade submissions for this course' });
    }

    const assignment = await Assignment.findById(submission.assignmentId).select('title totalMarks passingMarks');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const action = req.body.action || 'grade';
    const feedback = String(req.body.feedback ?? '').trim();

    if (action === 'review') {
      if (!['submitted', 'late'].includes(submission.status)) {
        return res.status(400).json({ success: false, message: 'Only submitted work can be moved to review' });
      }
      submission.status = 'under_review';
      await submission.save();
      return res.status(200).json({ success: true, submission });
    }

    if (action === 'return') {
      if (!feedback) {
        return res.status(400).json({ success: false, message: 'Feedback is required when returning work for revision' });
      }
      submission.status = 'returned_for_revision';
      submission.feedback = feedback;
      submission.gradingHistory.push({
        feedback,
        status: 'returned_for_revision',
        performedBy: req.user.id
      });
      await submission.save();
      await logAudit({
        action: 'SUBMISSION_RETURNED_FOR_REVISION',
        performedBy: req.user,
        role: req.user.role,
        targetResource: 'Submission',
        targetId: submission._id,
        details: { assignment: assignment.title, student: String(submission.studentId) }
      });
      return res.status(200).json({ success: true, submission });
    }

    // action === 'grade'
    const marks = Number(req.body.marksObtained);
    if (!Number.isFinite(marks) || marks < 0 || marks > assignment.totalMarks) {
      return res.status(400).json({ success: false, message: `Marks must be between 0 and ${assignment.totalMarks}` });
    }
    if (submission.status === 'draft') {
      return res.status(400).json({ success: false, message: 'This submission is still a draft' });
    }

    submission.marksObtained = marks;
    submission.feedback = feedback;
    submission.status = 'graded';
    submission.gradedBy = req.user.id;
    submission.gradedAt = new Date();
    submission.gradingHistory.push({
      marksObtained: marks,
      feedback,
      status: 'graded',
      performedBy: req.user.id
    });
    await submission.save();

    await logAudit({
      action: 'SUBMISSION_GRADED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Submission',
      targetId: submission._id,
      details: {
        assignment: assignment.title,
        student: String(submission.studentId),
        marks,
        totalMarks: assignment.totalMarks,
        passed: marks >= Number(assignment.passingMarks ?? 0)
      }
    });
    res.status(200).json({ success: true, submission });
  } catch (error) {
    next(error);
  }
};
