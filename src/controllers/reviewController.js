const Review = require('../models/Review');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const mongoose = require('mongoose');
const fs = require('fs');
const {
  uploadTestimonialVideoToGridFS,
  deleteTestimonialVideoFromGridFS,
  getTestimonialVideoFile,
  getTestimonialVideoBucket,
  removeTemporaryFile
} = require('../utils/testimonialVideoStorage');

/**
 * Helper to resolve target course from either :courseId param or body
 */
const resolveTargetCourse = async (identifier) => {
  if (!identifier) return null;
  if (mongoose.isValidObjectId(identifier)) {
    return await Course.findById(identifier);
  }
  return await Course.findOne({ slug: identifier });
};

/**
 * Helper to recalculate course rating and ratingCount from published reviews
 */
const updateCourseRatingSummary = async (courseId) => {
  try {
    const stats = await Review.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId),
          status: { $in: ['published', 'active'] }
        }
      },
      {
        $group: {
          _id: '$courseId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Course.findByIdAndUpdate(courseId, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        ratingCount: stats[0].count
      });
    } else {
      await Course.findByIdAndUpdate(courseId, {
        rating: 5.0,
        ratingCount: 0
      });
    }
  } catch (err) {
    console.warn('Could not update course rating stats:', err.message);
  }
};

/**
 * Public: Get reviews for a specific course
 * Accepts course ObjectId or slug.
 * Returns only published / active reviews for that exact course.
 * @route GET /api/v1/courses/:courseId/reviews OR GET /api/v1/reviews/course/:courseId
 */
exports.getCourseReviews = async (req, res, next) => {
  try {
    const courseParam = req.params.courseId || req.params.identifier;
    const course = await resolveTargetCourse(courseParam);

    if (!course) {
      return res.status(200).json({ success: true, reviews: [], count: 0 });
    }

    const reviews = await Review.find({
      courseId: course._id,
      status: { $in: ['published', 'active'] }
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enrolled Student: Check if user is eligible to submit review for course
 * @route GET /api/v1/reviews/check-eligibility/:courseId
 */
exports.checkReviewEligibility = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(200).json({
        canReview: false,
        reason: 'Please log in to submit a review for this course.'
      });
    }

    // Admin can always review
    if (user.role === 'admin') {
      return res.status(200).json({ canReview: true, isAdmin: true });
    }

    const course = await resolveTargetCourse(req.params.courseId);
    if (!course) {
      return res.status(404).json({ canReview: false, message: 'Course not found' });
    }

    // Check active enrollment with approval
    const enrollment = await Enrollment.findOne({
      student: user._id,
      course: course._id,
      status: 'approved'
    });

    if (!enrollment) {
      return res.status(200).json({
        canReview: false,
        reason: 'Only enrolled students with approved and active course access can submit reviews.'
      });
    }

    // Check if student already submitted a review
    const existingReview = await Review.findOne({
      courseId: course._id,
      studentId: user._id
    });

    if (existingReview) {
      return res.status(200).json({
        canReview: false,
        hasReviewed: true,
        review: existingReview,
        reason: 'You have already submitted a review for this course.'
      });
    }

    res.status(200).json({ canReview: true, hasActiveAccess: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all reviews with course, status, rating, search filters
 * @route GET /api/v1/reviews/admin
 */
exports.getAdminReviews = async (req, res, next) => {
  try {
    const courseId = req.query.courseId || req.params.courseId;
    const { status, rating, search } = req.query;
    const query = {};

    if (courseId && courseId !== 'all') {
      const course = await resolveTargetCourse(courseId);
      if (course) {
        query.courseId = course._id;
      } else if (mongoose.isValidObjectId(courseId)) {
        query.courseId = courseId;
      }
    }

    if (status && status !== 'all') {
      if (status === 'published' || status === 'active') {
        query.status = { $in: ['published', 'active'] };
      } else if (status === 'draft' || status === 'inactive') {
        query.status = { $in: ['draft', 'inactive'] };
      } else {
        query.status = status;
      }
    }

    if (rating && rating !== 'all') {
      const numRating = Number(rating);
      if (numRating >= 1 && numRating <= 5) {
        query.rating = numRating;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { reviewerName: regex },
        { studentName: regex },
        { studentEmail: regex },
        { headline: regex },
        { title: regex },
        { content: regex },
        { comment: regex }
      ];
    }

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .select('-thumbnailData')
      .populate('courseId', 'title slug thumbnail')
      .populate('studentId', 'name email');

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get single review by ID
 * @route GET /api/v1/reviews/admin/:id
 */
exports.getReviewById = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('courseId', 'title slug thumbnail')
      .populate('studentId', 'name email');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    res.status(200).json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin / Student: Submit or Create a Review
 * - If called by a regular student, verifies active course enrollment and marks as 'pending' (isRead: false).
 * - If called by an admin, allows immediate publication or draft setting.
 * @route POST /api/v1/courses/:courseId/reviews OR POST /api/v1/reviews
 */
exports.createReview = async (req, res, next) => {
  let videoUploadMeta = null;
  const videoFile = req.files?.videoFile?.[0];
  const thumbnailFile = req.files?.thumbnailFile?.[0];
  const avatarFile = req.files?.avatarFile?.[0];

  try {
    const targetCourseParam = req.params.courseId || req.body.courseId;
    if (!targetCourseParam) {
      return res.status(400).json({ success: false, message: 'Target Course ID is required' });
    }

    const course = await resolveTargetCourse(targetCourseParam);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Associated course not found in database' });
    }

    const currentUser = req.user;
    const isAdmin = currentUser?.role === 'admin';

    // Enrollment validation for non-admin students
    if (!isAdmin) {
      if (!currentUser) {
        return res.status(401).json({ success: false, message: 'Please log in to submit a review' });
      }

      // Check active approved enrollment
      const enrollment = await Enrollment.findOne({
        student: currentUser._id,
        course: course._id,
        status: 'approved'
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'Only students enrolled with approved access can submit a review for this course.'
        });
      }

      // Prevent duplicate review per student per course
      const existing = await Review.findOne({
        courseId: course._id,
        studentId: currentUser._id
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted a review for this course.'
        });
      }
    }

    const {
      reviewerName,
      studentName,
      studentEmail,
      reviewerDesignation = '',
      designation = '',
      reviewType = 'text',
      headline = '',
      title = '',
      content,
      comment,
      rating = 5,
      reviewDate,
      videoSourceType = 'external',
      videoUrl = '',
      videoThumbnail = '',
      thumbnailUrl = '',
      duration = 0,
      status
    } = req.body;

    const finalReviewerName = (reviewerName || studentName || currentUser?.name || '').trim();
    const finalStudentEmail = (studentEmail || currentUser?.email || '').trim().toLowerCase();
    const finalContent = (content || comment || '').trim();
    const finalDesignation = (reviewerDesignation || designation || (currentUser?.role === 'student' ? 'Student' : '')).trim();
    const finalHeadline = (headline || title || '').trim();
    const finalThumbnail = (videoThumbnail || thumbnailUrl || '').trim();
    let finalAvatar = (req.body.reviewerAvatar || req.body.studentAvatar || currentUser?.avatar || '').trim();

    if (!finalReviewerName) {
      return res.status(400).json({ success: false, message: 'Student / Reviewer name is required' });
    }

    if (!finalContent) {
      return res.status(400).json({ success: false, message: 'Review message / content is required' });
    }

    // Default status: Students always submit as 'pending'; Admin defaults to 'published' or requested status
    let finalStatus = 'pending';
    let isRead = false;

    if (isAdmin) {
      finalStatus = status || 'published';
      isRead = true; // Admin created it themselves
    }

    // Process video upload if reviewType === 'video'
    let videoFileId = null;
    let storedVideoUrl = videoUrl;
    if (reviewType === 'video') {
      if (videoSourceType === 'upload' && videoFile) {
        videoUploadMeta = await uploadTestimonialVideoToGridFS(videoFile);
        videoFileId = videoUploadMeta.fileId;
        storedVideoUrl = `/api/v1/reviews/${videoFileId}/stream`;
      } else if (videoSourceType === 'upload' && !videoFile) {
        return res.status(400).json({ success: false, message: 'Please select a video file to upload' });
      }
    }

    // Process thumbnail file
    let thumbnailData = null;
    let thumbnailMimeType = '';
    let resolvedThumbnailUrl = finalThumbnail;

    if (thumbnailFile) {
      thumbnailData = fs.readFileSync(thumbnailFile.path);
      thumbnailMimeType = thumbnailFile.mimetype;
    }

    // Process avatar file
    if (avatarFile) {
      const buffer = fs.readFileSync(avatarFile.path);
      finalAvatar = `data:${avatarFile.mimetype};base64,${buffer.toString('base64')}`;
    }

    const review = await Review.create({
      courseId: course._id,
      studentId: currentUser?._id || null,
      studentEmail: finalStudentEmail,
      reviewType,
      reviewerName: finalReviewerName,
      studentName: finalReviewerName,
      reviewerDesignation: finalDesignation,
      reviewerAvatar: finalAvatar,
      headline: finalHeadline,
      title: finalHeadline,
      content: finalContent,
      comment: finalContent,
      rating: rating ? Math.max(1, Math.min(5, Number(rating) || 5)) : 5,
      reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
      videoSourceType,
      videoFileId,
      videoUrl: storedVideoUrl,
      videoThumbnail: resolvedThumbnailUrl,
      thumbnailData,
      thumbnailMimeType,
      duration: Number(duration) || 0,
      status: finalStatus,
      isRead,
      displayOrder: Number(req.body.displayOrder) || 0
    });

    if (thumbnailData) {
      review.videoThumbnail = `/api/v1/reviews/${review._id}/thumbnail`;
      await review.save();
    }

    // Update course rating stats if review is published
    if (finalStatus === 'published' || finalStatus === 'active') {
      await updateCourseRatingSummary(course._id);
    }

    const created = await Review.findById(review._id)
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

    res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Review created successfully'
        : 'Thank you! Your review has been submitted for Admin approval.',
      review: created
    });
  } catch (error) {
    if (videoUploadMeta?.fileId) {
      await deleteTestimonialVideoFromGridFS(videoUploadMeta.fileId).catch(() => {});
    }
    next(error);
  } finally {
    if (videoFile) removeTemporaryFile(videoFile);
    if (thumbnailFile) removeTemporaryFile(thumbnailFile);
    if (avatarFile) removeTemporaryFile(avatarFile);
  }
};

/**
 * Admin: Update review (edit fields, or approve/reject status)
 * @route PUT /api/v1/reviews/:id
 */
exports.updateReview = async (req, res, next) => {
  let videoUploadMeta = null;
  const videoFile = req.files?.videoFile?.[0];
  const thumbnailFile = req.files?.thumbnailFile?.[0];
  const avatarFile = req.files?.avatarFile?.[0];

  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const {
      courseId,
      reviewerName,
      studentName,
      studentEmail,
      reviewerDesignation,
      designation,
      reviewType,
      headline,
      title,
      content,
      comment,
      rating,
      reviewDate,
      videoSourceType,
      videoUrl,
      videoThumbnail,
      thumbnailUrl,
      duration,
      status,
      displayOrder
    } = req.body;

    if (courseId) {
      const course = await resolveTargetCourse(courseId);
      if (course) review.courseId = course._id;
    }

    if (reviewerName !== undefined || studentName !== undefined) {
      const name = (reviewerName || studentName || '').trim();
      review.reviewerName = name;
      review.studentName = name;
    }

    if (studentEmail !== undefined) {
      review.studentEmail = studentEmail.trim().toLowerCase();
    }

    if (reviewerDesignation !== undefined || designation !== undefined) {
      const role = (reviewerDesignation || designation || '').trim();
      review.reviewerDesignation = role;
      review.designation = role;
    }

    if (headline !== undefined || title !== undefined) {
      const head = (headline || title || '').trim();
      review.headline = head;
      review.title = head;
    }

    if (content !== undefined || comment !== undefined) {
      const body = (content || comment || '').trim();
      review.content = body;
      review.comment = body;
    }

    if (rating !== undefined) {
      review.rating = Math.max(1, Math.min(5, Number(rating) || 5));
    }

    if (reviewDate !== undefined) {
      review.reviewDate = new Date(reviewDate);
    }

    if (status !== undefined) {
      review.status = status;
      // When admin changes status, mark notification as read
      review.isRead = true;
    }

    if (displayOrder !== undefined) {
      review.displayOrder = Number(displayOrder) || 0;
    }

    if (reviewType !== undefined) {
      review.reviewType = reviewType;
    }

    if (duration !== undefined) {
      review.duration = Number(duration) || 0;
    }

    // Video uploads / URLs
    if (videoSourceType !== undefined) review.videoSourceType = videoSourceType;
    if (videoUrl !== undefined) review.videoUrl = videoUrl;

    if (videoFile) {
      videoUploadMeta = await uploadTestimonialVideoToGridFS(videoFile);
      if (review.videoFileId) {
        await deleteTestimonialVideoFromGridFS(review.videoFileId).catch(() => {});
      }
      review.videoFileId = videoUploadMeta.fileId;
      review.videoUrl = `/api/v1/reviews/${videoUploadMeta.fileId}/stream`;
    }

    if (thumbnailFile) {
      review.thumbnailData = fs.readFileSync(thumbnailFile.path);
      review.thumbnailMimeType = thumbnailFile.mimetype;
      review.videoThumbnail = `/api/v1/reviews/${review._id}/thumbnail`;
    } else if (videoThumbnail !== undefined || thumbnailUrl !== undefined) {
      review.videoThumbnail = (videoThumbnail || thumbnailUrl || '').trim();
    }

    if (avatarFile) {
      const buffer = fs.readFileSync(avatarFile.path);
      review.reviewerAvatar = `data:${avatarFile.mimetype};base64,${buffer.toString('base64')}`;
      review.studentAvatar = review.reviewerAvatar;
    }

    await review.save();

    // Recalculate rating stats for the course
    await updateCourseRatingSummary(review.courseId);

    const updated = await Review.findById(review._id)
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updated
    });
  } catch (error) {
    if (videoUploadMeta?.fileId) {
      await deleteTestimonialVideoFromGridFS(videoUploadMeta.fileId).catch(() => {});
    }
    next(error);
  } finally {
    if (videoFile) removeTemporaryFile(videoFile);
    if (thumbnailFile) removeTemporaryFile(thumbnailFile);
    if (avatarFile) removeTemporaryFile(avatarFile);
  }
};

/**
 * Admin: Quick status transition (Approve / Reject)
 * @route PATCH /api/v1/reviews/:id/status
 */
exports.updateReviewStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'published', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status, isRead: true },
      { new: true }
    )
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await updateCourseRatingSummary(review.courseId);

    res.status(200).json({
      success: true,
      message: `Review marked as ${status}`,
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a Review
 * @route DELETE /api/v1/reviews/:id
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const courseId = review.courseId;

    if (review.videoFileId) {
      await deleteTestimonialVideoFromGridFS(review.videoFileId).catch(() => {});
    }

    await Review.findByIdAndDelete(req.params.id);

    // Refresh course rating
    if (courseId) {
      await updateCourseRatingSummary(courseId);
    }

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully from database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Mark pending reviews as read (clears notification badge)
 * @route POST /api/v1/reviews/admin/mark-read
 */
exports.markReviewsRead = async (req, res, next) => {
  try {
    await Review.updateMany({ isRead: false }, { $set: { isRead: true } });
    res.status(200).json({ success: true, message: 'Reviews marked as read' });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Stream Review Video from MongoDB GridFS
 * @route GET /api/v1/reviews/:id/stream
 */
exports.streamVideo = async (req, res, next) => {
  try {
    const { id } = req.params;
    let review = null;

    if (mongoose.isValidObjectId(id)) {
      review = await Review.findById(id);
    }

    const fileId = review?.videoFileId || id;
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const file = await getTestimonialVideoFile(fileId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Video file not found in storage' });
    }

    const range = req.headers.range;
    const total = file.length;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.contentType || 'video/mp4'
      });

      const stream = getTestimonialVideoBucket().openDownloadStream(file._id, {
        start,
        end: end + 1
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': file.contentType || 'video/mp4'
      });
      const stream = getTestimonialVideoBucket().openDownloadStream(file._id);
      stream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Serve review thumbnail from MongoDB binary buffer
 * @route GET /api/v1/reviews/:id/thumbnail
 */
exports.getThumbnail = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review || !review.thumbnailData) {
      return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    }

    res.set('Content-Type', review.thumbnailMimeType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(review.thumbnailData);
  } catch (error) {
    next(error);
  }
};
