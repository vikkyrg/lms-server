const mongoose = require('mongoose');

/**
 * Course Review Schema
 * Supports course-specific text-based and video-based reviews.
 * Includes MongoDB GridFS video references, binary thumbnails, external video URLs,
 * reviewer name, designation/role, avatar, star rating, headline, content,
 * reviewDate, publication status (draft/published/archived/active/inactive), and displayOrder.
 * Aliased to support both reviewerName/studentName, reviewerDesignation/designation,
 * headline/title, and content/comment seamlessly.
 */
const reviewSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Please provide course ID'],
      index: true
    },
    // Optional reference if created by an enrolled student
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Review classification: 'text' or 'video'
    reviewType: {
      type: String,
      enum: ['text', 'video'],
      default: 'text',
      required: true,
      index: true
    },
    // Reviewer name (with studentName alias support)
    reviewerName: {
      type: String,
      trim: true
    },
    studentName: {
      type: String,
      trim: true
    },
    reviewerDesignation: {
      type: String,
      default: '',
      trim: true
    },
    designation: {
      type: String,
      default: '',
      trim: true
    },
    reviewerAvatar: {
      type: String,
      default: '',
      trim: true
    },
    studentAvatar: {
      type: String,
      default: '',
      trim: true
    },
    headline: {
      type: String,
      default: '',
      trim: true
    },
    title: {
      type: String,
      default: '',
      trim: true
    },
    content: {
      type: String,
      trim: true
    },
    comment: {
      type: String,
      trim: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    reviewDate: {
      type: Date,
      default: Date.now
    },
    // Video Review specific properties
    videoSourceType: {
      type: String,
      enum: ['upload', 'external'],
      default: 'external'
    },
    videoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    videoUrl: {
      type: String,
      default: '',
      trim: true
    },
    videoThumbnail: {
      type: String,
      default: '',
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true
    },
    thumbnailData: {
      type: Buffer,
      default: null
    },
    thumbnailMimeType: {
      type: String,
      default: ''
    },
    duration: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'active', 'inactive'],
      default: 'published',
      index: true
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-validate hook to guarantee both naming conventions (reviewerName/studentName, content/comment, etc.)
// are synchronized and populated before saving to MongoDB
reviewSchema.pre('validate', function (next) {
  const name = (this.reviewerName || this.studentName || '').trim();
  if (!name) {
    return next(new Error('Please provide reviewer name'));
  }
  this.reviewerName = name;
  this.studentName = name;

  const body = (this.content || this.comment || '').trim();
  if (!body) {
    return next(new Error('Please provide review content or description'));
  }
  this.content = body;
  this.comment = body;

  const role = (this.reviewerDesignation || this.designation || '').trim();
  this.reviewerDesignation = role;
  this.designation = role;

  const head = (this.headline || this.title || '').trim();
  this.headline = head;
  this.title = head;

  const avatar = (this.reviewerAvatar || this.studentAvatar || '').trim();
  this.reviewerAvatar = avatar;
  this.studentAvatar = avatar;

  const thumb = (this.videoThumbnail || this.thumbnailUrl || '').trim();
  this.videoThumbnail = thumb;
  this.thumbnailUrl = thumb;

  // Normalize status for compatibility
  if (this.status === 'active') this.status = 'published';
  if (this.status === 'inactive') this.status = 'draft';

  next();
});

reviewSchema.index({ courseId: 1, status: 1, displayOrder: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
