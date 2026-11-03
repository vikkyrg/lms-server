const Review = require('../models/Review');
const Course = require('../models/Course');
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
 * Public: Get reviews for a specific course
 * Accepts course ObjectId or slug.
 * Returns only published / active reviews for that exact course.
 * @route GET /api/v1/courses/:courseId/reviews  OR  GET /api/v1/reviews/course/:courseId
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
 * Admin: Get all reviews or filter by course
 * @route GET /api/v1/reviews/admin
 */
exports.getAdminReviews = async (req, res, next) => {
  try {
    const courseId = req.query.courseId || req.params.courseId;
    const { status, reviewType, search } = req.query;
    const query = {};

    if (courseId) {
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

    if (reviewType && reviewType !== 'all') {
      query.reviewType = reviewType;
    }

    if (search && search.trim()) {
      query.$or = [
        { reviewerName: { $regex: search.trim(), $options: 'i' } },
        { reviewerDesignation: { $regex: search.trim(), $options: 'i' } },
        { headline: { $regex: search.trim(), $options: 'i' } },
        { content: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const reviews = await Review.find(query)
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
 * Admin: Get single review by ID
 * @route GET /api/v1/reviews/admin/:id  OR  GET /api/v1/reviews/:id
 */
exports.getReviewById = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

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
 * Admin: Create a new Review for a course
 * @route POST /api/v1/courses/:courseId/reviews  OR  POST /api/v1/reviews
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

    const {
      reviewerName,
      studentName,
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
      status = 'published',
      displayOrder = 0,
      reviewerAvatar = '',
      studentAvatar = ''
    } = req.body;

    const finalReviewerName = (reviewerName || studentName || '').trim();
    const finalContent = (content || comment || '').trim();
    const finalDesignation = (reviewerDesignation || designation || '').trim();
    const finalHeadline = (headline || title || '').trim();
    const finalThumbnail = (videoThumbnail || thumbnailUrl || '').trim();
    let finalAvatar = (reviewerAvatar || studentAvatar || '').trim();

    if (!finalReviewerName) {
      return res.status(400).json({ success: false, message: 'Reviewer name is required' });
    }

    if (!finalContent) {
      return res.status(400).json({ success: false, message: 'Review content/description is required' });
    }

    // Process video upload if reviewType === 'video' and videoSourceType === 'upload'
    let videoFileId = null;
    let storedVideoUrl = videoUrl;
    if (reviewType === 'video') {
      if (videoSourceType === 'upload' && videoFile) {
        videoUploadMeta = await uploadTestimonialVideoToGridFS(videoFile);
        videoFileId = videoUploadMeta.fileId;
        storedVideoUrl = `/api/v1/reviews/${videoFileId}/stream`;
      } else if (videoSourceType === 'upload' && !videoFile) {
        return res.status(400).json({ success: false, message: 'Please select an MP4/WebM video file to upload' });
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
      studentId: req.user?._id || null,
      reviewType,
      reviewerName: finalReviewerName,
      reviewerDesignation: finalDesignation,
      reviewerAvatar: finalAvatar,
      headline: finalHeadline,
      content: finalContent,
      rating: rating ? Math.max(1, Math.min(5, Number(rating) || 5)) : 5,
      reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
      videoSourceType,
      videoFileId,
      videoUrl: storedVideoUrl,
      videoThumbnail: resolvedThumbnailUrl,
      thumbnailData,
      thumbnailMimeType,
      duration: Number(duration) || 0,
      status: status || 'published',
      displayOrder: Number(displayOrder) || 0
    });

    // If binary thumbnail was uploaded, set dynamic streaming endpoint
    if (thumbnailData) {
      review.videoThumbnail = `/api/v1/reviews/${review._id}/thumbnail`;
      await review.save();
    }

    // If uploaded video, set stream URL with review ID
    if (videoFileId) {
      review.videoUrl = `/api/v1/reviews/${review._id}/stream`;
      await review.save();
    }

    const savedReview = await Review.findById(review._id)
      .select('-thumbnailData')
      .populate('courseId', 'title slug');

    res.status(201).json({
      success: true,
      message: 'Review created successfully in database',
      review: savedReview
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
 * Admin: Update a Review
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
      displayOrder,
      reviewerAvatar,
      studentAvatar
    } = req.body;

    if (courseId) {
      const course = await resolveTargetCourse(courseId);
      if (course) review.courseId = course._id;
    }

    const newName = reviewerName !== undefined ? reviewerName : studentName;
    if (newName !== undefined) review.reviewerName = newName.trim();

    const newDesignation = reviewerDesignation !== undefined ? reviewerDesignation : designation;
    if (newDesignation !== undefined) review.reviewerDesignation = newDesignation.trim();

    if (reviewType !== undefined) review.reviewType = reviewType;

    const newHeadline = headline !== undefined ? headline : title;
    if (newHeadline !== undefined) review.headline = newHeadline.trim();

    const newContent = content !== undefined ? content : comment;
    if (newContent !== undefined) review.content = newContent.trim();

    if (rating !== undefined) review.rating = Math.max(1, Math.min(5, Number(rating) || 5));
    if (reviewDate !== undefined) review.reviewDate = new Date(reviewDate);
    if (videoSourceType !== undefined) review.videoSourceType = videoSourceType;
    if (videoUrl !== undefined) review.videoUrl = videoUrl;

    const newThumb = videoThumbnail !== undefined ? videoThumbnail : thumbnailUrl;
    if (newThumb !== undefined) review.videoThumbnail = newThumb;

    if (duration !== undefined) review.duration = Number(duration) || 0;
    if (status !== undefined) review.status = status;
    if (displayOrder !== undefined) review.displayOrder = Number(displayOrder) || 0;

    const newAvatar = reviewerAvatar !== undefined ? reviewerAvatar : studentAvatar;
    if (newAvatar !== undefined) review.reviewerAvatar = newAvatar;

    // Handle avatar upload
    if (avatarFile) {
      const buffer = fs.readFileSync(avatarFile.path);
      review.reviewerAvatar = `data:${avatarFile.mimetype};base64,${buffer.toString('base64')}`;
    }

    // Handle new video file upload
    if (videoFile) {
      videoUploadMeta = await uploadTestimonialVideoToGridFS(videoFile);
      if (review.videoFileId) {
        await deleteTestimonialVideoFromGridFS(review.videoFileId).catch(() => {});
      }
      review.videoFileId = videoUploadMeta.fileId;
      review.videoUrl = `/api/v1/reviews/${review._id}/stream`;
    }

    // Handle new thumbnail file upload
    if (thumbnailFile) {
      review.thumbnailData = fs.readFileSync(thumbnailFile.path);
      review.thumbnailMimeType = thumbnailFile.mimetype;
      review.videoThumbnail = `/api/v1/reviews/${review._id}/thumbnail`;
    }

    await review.save();

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
 * Admin: Delete a Review
 * @route DELETE /api/v1/reviews/:id
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.videoFileId) {
      await deleteTestimonialVideoFromGridFS(review.videoFileId).catch(() => {});
    }

    await Review.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully from database'
    });
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
    const fileSize = file.length;
    const contentType = file.metadata?.contentType || file.contentType || 'video/mp4';

    if (!range) {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      getTestimonialVideoBucket()
        .openDownloadStream(new mongoose.Types.ObjectId(fileId))
        .pipe(res);
      return;
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });

    getTestimonialVideoBucket()
      .openDownloadStream(new mongoose.Types.ObjectId(fileId), { start, end: end + 1 })
      .pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Serve review thumbnail image
 * @route GET /api/v1/reviews/:id/thumbnail
 */
exports.getThumbnail = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review || !review.thumbnailData) {
      return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    }

    res.set({
      'Content-Type': review.thumbnailMimeType || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    });
    res.send(review.thumbnailData);
  } catch (error) {
    next(error);
  }
};
