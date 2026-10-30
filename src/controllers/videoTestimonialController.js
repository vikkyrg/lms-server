const VideoTestimonial = require('../models/VideoTestimonial');
const fs = require('fs');
const path = require('path');

// Helper to convert YouTube watch / short link to standard embed URL
const normalizeYouTubeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();

  // If already embed URL
  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed;
  }

  // Standard watch link: youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  return trimmed;
};

// Helper to extract YouTube thumbnail if none provided
const getYouTubeThumbnail = (url) => {
  if (!url) return '';
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return '';
};

/**
 * @desc    Get active video testimonials for homepage
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

    const videos = await VideoTestimonial.find(query)
      .select('studentName designation courseName videoSourceType videoUrl thumbnailUrl duration description displayOrder isFeatured')
      .sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: videos.length,
      videoTestimonials: videos
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

    res.status(200).json({
      success: true,
      count: videos.length,
      videoTestimonials: videos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single video testimonial for admin
 * @route   GET /api/v1/video-testimonials/admin/:id
 * @access  Private/Admin
 */
exports.getVideoTestimonialById = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }
    res.status(200).json({ success: true, videoTestimonial: video });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new video testimonial
 * @route   POST /api/v1/video-testimonials
 * @access  Private/Admin
 */
exports.createVideoTestimonial = async (req, res, next) => {
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
      return res.status(400).json({
        success: false,
        message: 'Please provide student name'
      });
    }

    let finalVideoUrl = videoUrl ? videoUrl.trim() : '';
    let finalSourceType = videoSourceType || 'external';

    // If an MP4 video file was uploaded
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
      finalVideoUrl = `/uploads/videos/${req.files.videoFile[0].filename}`;
      finalSourceType = 'upload';
    } else if (finalSourceType === 'external') {
      if (!finalVideoUrl) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid video URL or upload an MP4 file'
        });
      }
      finalVideoUrl = normalizeYouTubeUrl(finalVideoUrl);
    }

    // Determine thumbnail
    let finalThumbnail = thumbnailUrl ? thumbnailUrl.trim() : '';
    if (req.files && req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      finalThumbnail = `/uploads/thumbnails/${req.files.thumbnailFile[0].filename}`;
    } else if (!finalThumbnail && finalSourceType === 'external') {
      finalThumbnail = getYouTubeThumbnail(finalVideoUrl);
    }

    const videoTestimonial = await VideoTestimonial.create({
      studentName: studentName.trim(),
      designation: (designation || '').trim(),
      courseName: (courseName || '').trim(),
      videoSourceType: finalSourceType,
      videoUrl: finalVideoUrl,
      thumbnailUrl: finalThumbnail,
      duration: Number(duration) || 0,
      description: description ? description.trim() : '',
      status: status === 'inactive' ? 'inactive' : 'active',
      displayOrder: Number(displayOrder) || 0,
      isFeatured: isFeatured === 'true' || isFeatured === true
    });

    res.status(201).json({
      success: true,
      message: 'Video testimonial created successfully',
      videoTestimonial
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update video testimonial
 * @route   PUT /api/v1/video-testimonials/:id
 * @access  Private/Admin
 */
exports.updateVideoTestimonial = async (req, res, next) => {
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

    // Source type & Video URL
    if (req.files && req.files.videoFile && req.files.videoFile[0]) {
      // Remove old uploaded video if it exists on disk
      if (video.videoSourceType === 'upload' && video.videoUrl.startsWith('/uploads/videos/')) {
        const oldPath = path.join(__dirname, '../../', video.videoUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      video.videoUrl = `/uploads/videos/${req.files.videoFile[0].filename}`;
      video.videoSourceType = 'upload';
    } else if (videoUrl !== undefined && videoUrl.trim()) {
      video.videoSourceType = videoSourceType || 'external';
      video.videoUrl = normalizeYouTubeUrl(videoUrl);
    }

    // Thumbnail
    if (req.files && req.files.thumbnailFile && req.files.thumbnailFile[0]) {
      video.thumbnailUrl = `/uploads/thumbnails/${req.files.thumbnailFile[0].filename}`;
    } else if (thumbnailUrl !== undefined) {
      video.thumbnailUrl = thumbnailUrl.trim() || (video.videoSourceType === 'external' ? getYouTubeThumbnail(video.videoUrl) : '');
    }

    await video.save();

    res.status(200).json({
      success: true,
      message: 'Video testimonial updated successfully',
      videoTestimonial: video
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete video testimonial
 * @route   DELETE /api/v1/video-testimonials/:id
 * @access  Private/Admin
 */
exports.deleteVideoTestimonial = async (req, res, next) => {
  try {
    const video = await VideoTestimonial.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video testimonial not found' });
    }

    // If uploaded video, delete from disk
    if (video.videoSourceType === 'upload' && video.videoUrl.startsWith('/uploads/videos/')) {
      const filePath = path.join(__dirname, '../../', video.videoUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }

    await video.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Video testimonial deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

