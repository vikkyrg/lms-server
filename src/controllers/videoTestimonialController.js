const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const VideoTestimonial = require('../models/VideoTestimonial');
const {
  getTestimonialVideoBucket,
  uploadTestimonialVideoToGridFS,
  deleteTestimonialVideoFromGridFS,
  getTestimonialVideoFile,
  removeTempFile
} = require('../utils/testimonialVideoStorage');

// Helper to convert YouTube link to standard embed URL
const normalizeYouTubeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('youtube.com/embed/')) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return trimmed;
};

// Helper to extract YouTube thumbnail if none provided
const getYouTubeThumbnail = (url) => {
  if (!url) return '';
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return '';
};

// Formats testimonial payload for client consumption
const formatTestimonialResponse = (doc) => {
  const item = doc.toObject ? doc.toObject() : { ...doc };
  // Remove binary buffer from general JSON response to save bandwidth
  delete item.thumbnailData;

  // Determine streaming / play URL
  if (item.videoSourceType === 'upload' && item.videoFileId) {
    item.videoUrl = `/api/v1/video-testimonials/${item._id}/video`;
  } else if (!item.videoUrl && item.videoFileId) {
    item.videoUrl = `/api/v1/video-testimonials/${item._id}/video`;
  }

  // Determine thumbnail URL
  if (doc.thumbnailData || (doc.thumbnailMimeType && !item.thumbnailUrl)) {
    item.thumbnailUrl = `/api/v1/video-testimonials/${item._id}/thumbnail`;
  }

  return item;
};

/**
 * @desc    Get active video testimonials for homepage / public
 * @route   GET /api/v1/video-testimonials
 * @access  Public
 */
exports.getPublicVideoTestimonials = async (req, res, next) => {
  try {
    const { featured } = req.query;
    const query = { status: 'active' };
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const videos = await VideoTestimonial.find(query).sort({
      displayOrder: 1,
      createdAt: -1
    });

    const formattedVideos = videos.map(formatTestimonialResponse);

    res.status(200).json({
      success: true,
      count: formattedVideos.length,
      videoTestimonials: formattedVideos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all video testimonials for admin
 * @route   GET /api/v1/video-testimonials/admin
 * @access  Private/Admin
 */
exports.getAdminVideoTestimonials = async (req, res, next) => {
  try {
    const { status, search, sort } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { displayOrder: 1, createdAt: -1 };
    if (sort === 'order-desc') {
      sortOptions = { displayOrder: -1, createdAt: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'duration') {
      sortOptions = { duration: -1 };
    }

    const videos = await VideoTestimonial.find(query).sort(sortOptions);
    const formatted = videos.map(formatTestimonialResponse);

    res.status(200).json({
      success: true,
      count: formatted.length,
      videoTestimonials: formatted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single video testimonial
 * @route   GET /api/v1/video-testimonials/admin/:id
 * @access  Private/Admin
 */
exports.getVideoTestimonialById = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }
    res.status(200).json({ success: true, videoTestimonial: formatTestimonialResponse(video) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stream video directly from MongoDB GridFS with HTTP 206 Range support
 * @route   GET /api/v1/video-testimonials/:id/video
 * @access  Public
 */
exports.streamVideo = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }

    if (!video.videoFileId) {
      // If external video, redirect to original URL
      if (video.videoUrl) {
        return res.redirect(video.videoUrl);
      }
      return res.status(404).json({ success: false, message: 'No video stream available for this testimonial' });
    }

    const file = await getTestimonialVideoFile(video.videoFileId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Video file not found in MongoDB GridFS' });
    }

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
      'Content-Type': file.contentType || video.videoMimeType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(length),
      ...(statusCode === 206 ? { 'Content-Range': `bytes ${start}-${end}/${total}` } : {})
    });

    const downloadStream = getTestimonialVideoBucket().openDownloadStream(
      new mongoose.Types.ObjectId(file._id),
      {
        start,
        end: end + 1
      }
    );

    downloadStream.on('error', next);
    req.on('close', () => {
      if (!res.writableEnded) downloadStream.destroy();
    });
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Serve thumbnail stored as raw binary in MongoDB
 * @route   GET /api/v1/video-testimonials/:id/thumbnail
 * @access  Public
 */
exports.getThumbnail = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id).select('thumbnailData thumbnailMimeType thumbnailUrl');
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }

    if (video.thumbnailData) {
      res.set('Content-Type', video.thumbnailMimeType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(video.thumbnailData);
    }

    if (video.thumbnailUrl) {
      return res.redirect(video.thumbnailUrl);
    }

    res.status(404).json({ success: false, message: 'Thumbnail not available' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new video testimonial (saves video directly to GridFS & thumbnail to MongoDB)
 * @route   POST /api/v1/video-testimonials
 * @access  Private/Admin
 */
exports.createVideoTestimonial = async (req, res, next) => {
  const uploadedTempFiles = [];
  try {
    const {
      studentName,
      designation,
      courseName,
      videoSourceType,
      videoUrl,
      thumbnailUrl,
      duration,
      description,
      status,
      displayOrder,
      isFeatured
    } = req.body;

    if (!studentName) {
      return res.status(400).json({ success: false, message: 'Please provide student name' });
    }

    let finalSourceType = videoSourceType || 'upload';
    let videoFileId = null;
    let videoMimeType = 'video/mp4';
    let videoSize = 0;
    let finalVideoUrl = videoUrl ? videoUrl.trim() : '';

    // Handle video file upload to MongoDB GridFS
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
      const vFile = req.files.videoFile[0];
      uploadedTempFiles.push(vFile.path);

      const gridFsResult = await uploadTestimonialVideoToGridFS(vFile);
      videoFileId = gridFsResult.fileId;
      videoMimeType = gridFsResult.contentType || 'video/mp4';
      videoSize = gridFsResult.size;
      finalSourceType = 'upload';
      finalVideoUrl = ''; // will be resolved via dynamic streaming route
    } else if (finalSourceType === 'external') {
      if (!finalVideoUrl) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid video URL or upload a video file'
        });
      }
      finalVideoUrl = normalizeYouTubeUrl(finalVideoUrl);
    }

    // Handle thumbnail
    let thumbnailData = null;
    let thumbnailMimeType = '';
    let finalThumbnailUrl = thumbnailUrl ? thumbnailUrl.trim() : '';

    if (req.files && req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      const tFile = req.files.thumbnailFile[0];
      uploadedTempFiles.push(tFile.path);
      thumbnailData = fs.readFileSync(tFile.path);
      thumbnailMimeType = tFile.mimetype;
      finalThumbnailUrl = '';
    } else if (!finalThumbnailUrl && finalSourceType === 'external') {
      finalThumbnailUrl = getYouTubeThumbnail(finalVideoUrl);
    }

    const videoTestimonial = await VideoTestimonial.create({
      studentName: studentName.trim(),
      designation: (designation || '').trim(),
      courseName: (courseName || '').trim(),
      videoSourceType: finalSourceType,
      videoFileId,
      videoMimeType,
      videoSize,
      videoUrl: finalVideoUrl,
      thumbnailData,
      thumbnailMimeType,
      thumbnailUrl: finalThumbnailUrl,
      duration: Number(duration) || 0,
      description: description ? description.trim() : '',
      status: status === 'inactive' ? 'inactive' : 'active',
      displayOrder: Number(displayOrder) || 0,
      isFeatured: isFeatured === 'true' || isFeatured === true
    });

    res.status(201).json({
      success: true,
      message: 'Video testimonial created successfully',
      videoTestimonial: formatTestimonialResponse(videoTestimonial)
    });
  } catch (error) {
    next(error);
  } finally {
    // Clean up temporary disk files
    uploadedTempFiles.forEach(removeTempFile);
  }
};

/**
 * @desc    Update video testimonial
 * @route   PUT /api/v1/video-testimonials/:id
 * @access  Private/Admin
 */
exports.updateVideoTestimonial = async (req, res, next) => {
  const uploadedTempFiles = [];
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }

    const {
      studentName,
      designation,
      courseName,
      videoSourceType,
      videoUrl,
      thumbnailUrl,
      duration,
      description,
      status,
      displayOrder,
      isFeatured
    } = req.body;

    if (studentName !== undefined) video.studentName = studentName.trim();
    if (designation !== undefined) video.designation = designation.trim();
    if (courseName !== undefined) video.courseName = courseName.trim();
    if (description !== undefined) video.description = description.trim();
    if (status !== undefined) video.status = status;
    if (displayOrder !== undefined) video.displayOrder = Number(displayOrder) || 0;
    if (isFeatured !== undefined) video.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (duration !== undefined) video.duration = Number(duration) || 0;

    // Handle new video file upload to GridFS
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
      const vFile = req.files.videoFile[0];
      uploadedTempFiles.push(vFile.path);

      // Delete old GridFS video if it exists
      if (video.videoFileId) {
        await deleteTestimonialVideoFromGridFS(video.videoFileId);
      }

      const gridFsResult = await uploadTestimonialVideoToGridFS(vFile);
      video.videoFileId = gridFsResult.fileId;
      video.videoMimeType = gridFsResult.contentType || 'video/mp4';
      video.videoSize = gridFsResult.size;
      video.videoSourceType = 'upload';
      video.videoUrl = '';
    } else if (videoUrl !== undefined && videoUrl.trim()) {
      video.videoSourceType = videoSourceType || 'external';
      video.videoUrl = normalizeYouTubeUrl(videoUrl);
      if (video.videoSourceType === 'external' && video.videoFileId) {
        await deleteTestimonialVideoFromGridFS(video.videoFileId);
        video.videoFileId = null;
      }
    }

    // Handle new thumbnail upload
    if (req.files && req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      const tFile = req.files.thumbnailFile[0];
      uploadedTempFiles.push(tFile.path);
      video.thumbnailData = fs.readFileSync(tFile.path);
      video.thumbnailMimeType = tFile.mimetype;
      video.thumbnailUrl = '';
    } else if (thumbnailUrl !== undefined) {
      if (thumbnailUrl.trim()) {
        video.thumbnailUrl = thumbnailUrl.trim();
        video.thumbnailData = null;
        video.thumbnailMimeType = '';
      }
    }

    await video.save();

    res.status(200).json({
      success: true,
      message: 'Video testimonial updated successfully',
      videoTestimonial: formatTestimonialResponse(video)
    });
  } catch (error) {
    next(error);
  } finally {
    uploadedTempFiles.forEach(removeTempFile);
  }
};

/**
 * @desc    Delete video testimonial & associated GridFS video
 * @route   DELETE /api/v1/video-testimonials/:id
 * @access  Private/Admin
 */
exports.deleteVideoTestimonial = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }

    // Delete GridFS file if exists
    if (video.videoFileId) {
      await deleteTestimonialVideoFromGridFS(video.videoFileId);
    }

    await VideoTestimonial.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Video testimonial and MongoDB media deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
