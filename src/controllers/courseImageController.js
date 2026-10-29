const CourseImage = require('../models/CourseImage');
const Course = require('../models/Course');
const mongoose = require('mongoose');

/**
 * Upload or Replace Course Thumbnail in MongoDB
 * @route POST /api/v1/courses/thumbnail/upload
 * @access Admin
 */
exports.uploadCourseThumbnail = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select an image file to upload' });
    }

    const { courseId } = req.body;

    // Validate image mime type
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Supported formats: JPG, JPEG, PNG, and WebP'
      });
    }

    // 5MB limit
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image size exceeds maximum limit of 5MB'
      });
    }

    // If courseId provided and valid, check if existing thumbnail image exists and cleanup
    let course = null;
    if (courseId && mongoose.isValidObjectId(courseId)) {
      course = await Course.findById(courseId);
      if (course && course.thumbnailImage) {
        await CourseImage.findByIdAndDelete(course.thumbnailImage).catch(() => {});
      }
    }

    // Create binary image document in MongoDB
    const courseImage = await CourseImage.create({
      course: course?._id || undefined,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      uploadedBy: req.user.id
    });

    const thumbnailUrl = `/api/v1/courses/thumbnail/${courseImage._id}`;

    // If existing course, link directly
    if (course) {
      course.thumbnailImage = courseImage._id;
      course.thumbnail = thumbnailUrl;
      await course.save();
    }

    res.status(201).json({
      success: true,
      message: 'Thumbnail image uploaded successfully to MongoDB',
      imageId: courseImage._id,
      thumbnailUrl,
      image: {
        id: courseImage._id,
        filename: courseImage.filename,
        contentType: courseImage.contentType,
        size: courseImage.size,
        createdAt: courseImage.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream Course Thumbnail from MongoDB by Image ID or Course ID
 * @route GET /api/v1/courses/thumbnail/:idOrCourseId
 * @access Public
 */
exports.getCourseThumbnail = async (req, res, next) => {
  try {
    const { idOrCourseId } = req.params;

    if (!mongoose.isValidObjectId(idOrCourseId)) {
      return res.status(400).json({ success: false, message: 'Invalid thumbnail or course ID' });
    }

    // Try finding by CourseImage _id first
    let imageDoc = await CourseImage.findById(idOrCourseId);

    // If not found by image id, try finding by course id
    if (!imageDoc) {
      imageDoc = await CourseImage.findOne({ course: idOrCourseId });
    }

    // Fallback: Check if course has a thumbnailImage reference
    if (!imageDoc) {
      const course = await Course.findById(idOrCourseId);
      if (course && course.thumbnailImage) {
        imageDoc = await CourseImage.findById(course.thumbnailImage);
      }
    }

    if (!imageDoc || !imageDoc.data) {
      return res.status(404).json({ success: false, message: 'Course thumbnail not found' });
    }

    // Send binary buffer with proper headers and client-side caching
    res.set({
      'Content-Type': imageDoc.contentType || 'image/jpeg',
      'Content-Length': imageDoc.size || imageDoc.data.length,
      'Cache-Control': 'public, max-age=86400, immutable',
      'ETag': `"${imageDoc._id.toString()}-${imageDoc.updatedAt.getTime()}"`
    });

    return res.end(imageDoc.data);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete / Remove Course Thumbnail
 * @route DELETE /api/v1/courses/thumbnail/:idOrCourseId
 * @access Admin
 */
exports.deleteCourseThumbnail = async (req, res, next) => {
  try {
    const { idOrCourseId } = req.params;

    if (!mongoose.isValidObjectId(idOrCourseId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    let imageDoc = await CourseImage.findById(idOrCourseId);
    let course = null;

    if (imageDoc) {
      if (imageDoc.course) {
        course = await Course.findById(imageDoc.course);
      }
      await CourseImage.findByIdAndDelete(imageDoc._id);
    } else {
      // idOrCourseId might be courseId
      course = await Course.findById(idOrCourseId);
      if (course && course.thumbnailImage) {
        await CourseImage.findByIdAndDelete(course.thumbnailImage);
      }
    }

    if (course) {
      course.thumbnail = '';
      course.thumbnailImage = undefined;
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: 'Course thumbnail removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

