const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const isCourseOwnerOrAdmin = require('../middleware/auth').isCourseOwnerOrAdmin;
const { isEnrollmentActive } = require('../utils/accessDuration');
const Enrollment = require('../models/Enrollment');
const {
  getBucket,
  uploadVideo,
  deleteVideo,
  getVideoFile,
  removeTemporaryFile
} = require('../utils/videoStorage');

const ensureCourseManager = async (req, courseId, res) => {
  if (!mongoose.isValidObjectId(courseId)) {
    res.status(400).json({ success: false, message: 'Invalid course id' });
    return false;
  }
  const result = await isCourseOwnerOrAdmin(req, courseId);
  if (!result.course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return false;
  }
  if (!result.allowed) {
    res.status(403).json({ success: false, message: 'You are not authorized to manage this course' });
    return false;
  }
  return true;
};

// Module controllers
// Admin management view: returns the FULL curriculum (including videoUrl and
// downloadable resources) so Admin can edit lessons without losing data.
// This endpoint is protected as admin-only in the routes.
exports.getModulesByCourse = async (req, res, next) => {
  try {
    const modules = await Module.find({ courseId: req.params.courseId }).sort('order');
    const lessons = await Lesson.find({ courseId: req.params.courseId }).sort('order');

    const curriculum = modules.map(m => ({
      ...m.toObject(),
      lessons: lessons
        .filter(l => l.moduleId.toString() === m._id.toString())
        .map(l => l.toObject())
    }));

    res.status(200).json({ success: true, modules: curriculum });
  } catch (error) {
    next(error);
  }
};

exports.createModule = async (req, res, next) => {
  try {
    if (!(await ensureCourseManager(req, req.body.courseId, res))) return;
    const { title, description, order, courseId } = req.body;
    const module = await Module.create({ title, description, order, courseId });
    res.status(201).json({ success: true, module });
  } catch (error) {
    next(error);
  }
};

exports.updateModule = async (req, res, next) => {
  try {
    const existing = await Module.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Module not found' });
    if (!(await ensureCourseManager(req, existing.courseId, res))) return;
    // Partial update: only apply fields explicitly provided so reorder
    // (order only) does not wipe title/description.
    const updates = {};
    ['title', 'description', 'order'].forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const module = await Module.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, module });
  } catch (error) {
    next(error);
  }
};

exports.deleteModule = async (req, res, next) => {
  try {
    const existing = await Module.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Module not found' });
    if (!(await ensureCourseManager(req, existing.courseId, res))) return;
    await Module.findByIdAndDelete(req.params.id);
    await Lesson.deleteMany({ moduleId: req.params.id });
    res.status(200).json({ success: true, message: 'Module and associated lessons deleted' });
  } catch (error) {
    next(error);
  }
};

// Lesson controllers
exports.createLesson = async (req, res, next) => {
  try {
    if (!(await ensureCourseManager(req, req.body.courseId, res))) return;
    const module = await Module.findOne({ _id: req.body.moduleId, courseId: req.body.courseId });
    if (!module) return res.status(400).json({ success: false, message: 'Module does not belong to this course' });
    const { title, courseId, moduleId, description, videoUrl, duration, order, isPreview, resources } = req.body;
    const lesson = await Lesson.create({ title, courseId, moduleId, description, videoUrl, duration, order, isPreview, resources });
    res.status(201).json({ success: true, lesson });
  } catch (error) {
    next(error);
  }
};

exports.updateLesson = async (req, res, next) => {
  try {
    const existing = await Lesson.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Lesson not found' });
    if (!(await ensureCourseManager(req, existing.courseId, res))) return;
    // Partial update so reorder (order only) preserves the rest of the lesson.
    const updates = {};
    ['title', 'description', 'videoUrl', 'duration', 'order', 'isPreview', 'resources'].forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, lesson });
  } catch (error) {
    next(error);
  }
};

exports.deleteLesson = async (req, res, next) => {
  try {
    const existing = await Lesson.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Lesson not found' });
    if (!(await ensureCourseManager(req, existing.courseId, res))) return;
    await Lesson.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    next(error);
  }
};

exports.uploadLessonVideo = async (req, res, next) => {
  let uploaded;
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
    if (lesson.courseId.toString() !== req.params.courseId) {
      return res.status(400).json({ success: false, message: 'Lesson does not belong to this course' });
    }
    if (!(await ensureCourseManager(req, lesson.courseId, res))) return;
    if (lesson.moduleId.toString() !== req.params.moduleId) {
      return res.status(400).json({ success: false, message: 'Lesson does not belong to this module' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose an MP4 or WebM video file' });

    uploaded = await uploadVideo(req.file);
    const oldFileId = lesson.video?.fileId;
    lesson.videoUrl = `/curriculum/courses/${lesson.courseId}/lessons/${lesson._id}/video`;
    lesson.video = {
      fileId: uploaded.fileId,
      storageKey: '',
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      size: uploaded.length,
      uploadedAt: new Date()
    };
    await lesson.save();
    if (oldFileId) await deleteVideo(oldFileId);
    return res.status(200).json({ success: true, lesson });
  } catch (error) {
    if (uploaded?.fileId) {
      try {
        await deleteVideo(uploaded.fileId);
      } catch (cleanupError) {
        console.error(`Unable to clean up failed GridFS upload: ${cleanupError.message}`);
      }
    }
    next(error);
  } finally {
    removeTemporaryFile(req.file);
  }
};

exports.deleteLessonVideo = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
    if (lesson.courseId.toString() !== req.params.courseId) {
      return res.status(400).json({ success: false, message: 'Lesson does not belong to this course' });
    }
    if (!(await ensureCourseManager(req, lesson.courseId, res))) return;
    if (lesson.moduleId.toString() !== req.params.moduleId) {
      return res.status(400).json({ success: false, message: 'Lesson does not belong to this module' });
    }
    if (lesson.video?.fileId) await deleteVideo(lesson.video.fileId);
    if (lesson.video?.storageKey) {
      const filePath = path.join(__dirname, '../../', lesson.video.storageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    lesson.videoUrl = '';
    lesson.video = {};
    await lesson.save();
    res.status(200).json({ success: true, lesson });
  } catch (error) {
    next(error);
  }
};

exports.streamLessonVideo = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
      return res.status(400).json({ success: false, message: 'Invalid course or lesson id' });
    }

    const lesson = await Lesson.findOne({ _id: lessonId, courseId }).select('courseId moduleId video');
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found for this course' });

    if (req.user.role !== 'admin') {
      const enrollment = await Enrollment.findOne({ student: req.user.id, course: courseId });
      if (!isEnrollmentActive(enrollment)) {
        return res.status(403).json({ success: false, message: 'Active course enrollment is required to watch this video' });
      }
    }

    const fileId = lesson.video?.fileId;
    const file = await getVideoFile(fileId);
    if (!file) return res.status(404).json({ success: false, message: 'Video file not found' });

    const total = file.length;
    const range = req.headers.range;
    let start = 0;
    let end = total - 1;
    let statusCode = 200;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.set('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      if (match[1]) start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
      else if (!match[1]) start = Math.max(total - Number(match[2]), 0);
      if (!match[2] && match[1]) end = total - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= total) {
        res.set('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      end = Math.min(end, total - 1);
      statusCode = 206;
    }

    const length = end - start + 1;
    res.status(statusCode);
    res.set({
      'Content-Type': file.contentType || lesson.video.contentType || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(length),
      ...(statusCode === 206 ? { 'Content-Range': `bytes ${start}-${end}/${total}` } : {})
    });

    const downloadStream = getBucket().openDownloadStream(new mongoose.Types.ObjectId(file._id), {
      start,
      end: end + 1
    });
    downloadStream.on('error', next);
    req.on('close', () => {
      if (!res.writableEnded) downloadStream.destroy();
    });
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
