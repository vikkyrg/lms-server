const CourseMaterial = require('../models/CourseMaterial');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { isEnrollmentActive } = require('../utils/accessDuration');

// Helper to extract user optionally from token
const getOptionalUser = async (req) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return user;
  } catch (err) {
    return null;
  }
};

// @desc Upload course material or replace existing material file (Admin)
// @route POST /api/v1/materials/upload
// @route PUT /api/v1/materials/:id/replace
exports.uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a file to upload' });
    }

    const { id } = req.params; // If replacing existing material
    const { title, description, courseId, moduleId, lessonId, isPublished } = req.body;

    const relativeUrl = `/uploads/materials/${req.file.filename}`;

    if (id) {
      // Replacing existing material file
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid material ID' });
      }

      const existingMaterial = await CourseMaterial.findById(id);
      if (!existingMaterial) {
        return res.status(404).json({ success: false, message: 'Material not found' });
      }

      // Try unlinking old file
      const oldPath = path.join(__dirname, '../../', existingMaterial.fileUrl);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to unlink old file:', e);
        }
      }

      if (title) existingMaterial.title = title;
      if (description !== undefined) existingMaterial.description = description;
      existingMaterial.fileUrl = relativeUrl;
      existingMaterial.fileName = req.file.originalname;
      existingMaterial.fileSize = req.file.size;
      existingMaterial.mimeType = req.file.mimetype;
      if (isPublished !== undefined) existingMaterial.isPublished = isPublished !== 'false';

      await existingMaterial.save();

      const { logAudit } = require('../utils/audit');
      await logAudit({
        action: 'COURSE_MATERIAL_REPLACED',
        performedBy: req.user,
        role: req.user.role,
        targetResource: 'CourseMaterial',
        targetId: existingMaterial._id,
        details: { title: existingMaterial.title, courseId: existingMaterial.course, fileName: existingMaterial.fileName }
      });

      return res.status(200).json({ success: true, material: existingMaterial });
    }

    // New Material creation
    if (!title || !courseId) {
      return res.status(400).json({ success: false, message: 'Title and Course are required' });
    }

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const material = await CourseMaterial.create({
      title,
      description: description || '',
      course: courseId,
      module: moduleId && moduleId.trim() !== '' ? moduleId : undefined,
      lesson: lessonId && lessonId.trim() !== '' ? lessonId : undefined,
      fileUrl: relativeUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      isPublished: isPublished !== 'false',
      uploadedBy: req.user.id
    });

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'COURSE_MATERIAL_UPLOADED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'CourseMaterial',
      targetId: material._id,
      details: { title: material.title, courseId, fileName: material.fileName }
    });

    res.status(201).json({ success: true, material });
  } catch (error) {
    next(error);
  }
};

// @desc Get materials for a course
// Public: Returns title, description, size, date for published course PDFs preview
// Authenticated student/admin: Returns materials with download authorization info
// @route GET /api/v1/materials/course/:courseId
exports.getMaterialsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Try detecting user if authenticated
    const currentUser = req.user || (await getOptionalUser(req));
    let hasActiveAccess = false;

    if (currentUser) {
      if (currentUser.role === 'admin') {
        hasActiveAccess = true;
      } else {
        const enrollment = await Enrollment.findOne({
          student: currentUser._id,
          course: courseId
        });
        // A student inside their active 3-month window keeps material access,
        // whether the enrollment is 'approved' or already 'completed'.
        if (enrollment && isEnrollmentActive(enrollment)) {
          hasActiveAccess = true;
        }
      }
    }

    const query = { course: courseId };
    if (!currentUser || currentUser.role !== 'admin') {
      query.isPublished = true;
    }

    const materials = await CourseMaterial.find(query)
      .select('title description course module lesson fileName fileSize mimeType isPublished createdAt')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: materials.length,
      hasActiveAccess,
      data: materials,
      materials
    });
  } catch (error) {
    next(error);
  }
};

// @desc Protected download / view of course document
// Validates student's active 3-month access period
// Supports either Authorization Bearer header or token in query param
// @route GET /api/v1/materials/:id/download
exports.downloadMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid material ID' });
    }

    const material = await CourseMaterial.findById(id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const currentUser = req.user || (await getOptionalUser(req));
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access protected course materials'
      });
    }

    if (currentUser.role !== 'admin') {
      if (!material.isPublished) {
        return res.status(403).json({ success: false, message: 'This document is not published' });
      }

      const enrollment = await Enrollment.findOne({
        student: currentUser._id,
        course: material.course
      });

      if (!enrollment) {
        return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
      }

      if (enrollment.status === 'pending_approval') {
        return res.status(403).json({ success: false, message: 'Enrollment awaiting Admin approval' });
      }

      if (enrollment.status === 'rejected') {
        return res.status(403).json({ success: false, message: 'Enrollment rejected' });
      }

      // Check 3-month window
      if (!isEnrollmentActive(enrollment)) {
        return res.status(403).json({
          success: false,
          message: 'Your 3-month course access has expired. File access is disabled.'
        });
      }
    }

    // Resolve local path
    const filePath = path.join(__dirname, '../../', material.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical file not found on server' });
    }

    res.setHeader('Content-Type', material.mimeType || 'application/pdf');
    // Ensure safe ASCII attachment name or inline view
    const safeName = material.fileName.replace(/[^\w.-]/g, '_');
    const isInline = req.query.inline === 'true';
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${safeName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

// @desc Update material details (Admin)
// @route PUT /api/v1/materials/:id
exports.updateMaterial = async (req, res, next) => {
  try {
    const { title, description, isPublished, moduleId } = req.body;
    const material = await CourseMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    if (title !== undefined) material.title = title;
    if (description !== undefined) material.description = description;
    if (isPublished !== undefined) material.isPublished = Boolean(isPublished);
    if (moduleId !== undefined) {
      material.module = moduleId && mongoose.isValidObjectId(moduleId) ? moduleId : undefined;
    }

    await material.save();
    res.status(200).json({ success: true, material });
  } catch (error) {
    next(error);
  }
};

// @desc Delete material (Admin)
// @route DELETE /api/v1/materials/:id
exports.deleteMaterial = async (req, res, next) => {
  try {
    const material = await CourseMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    // Try deleting physical file
    const filePath = path.join(__dirname, '../../', material.fileUrl);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('File unlink error:', e);
      }
    }

    await CourseMaterial.findByIdAndDelete(req.params.id);

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'COURSE_MATERIAL_DELETED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'CourseMaterial',
      targetId: req.params.id,
      details: { title: material.title, courseId: material.course }
    });

    res.status(200).json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    next(error);
  }
};
