const mongoose = require('mongoose');

/**
 * Course Review Schema
 * Supports course-specific text-based and video-based reviews.
 * Includes studentId, courseId, studentName, studentEmail, rating (1-5),
 * title/headline, comment/content, status (pending/published/rejected),
 * isRead (for admin notifications badge), reviewDate, and timestamps.
 */
const reviewSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Please provide course ID'],
      index: true
    },
    // Reference if submitted by an enrolled student
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    studentEmail: {
      type: String,
      trim: true,
      default: ''
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
    // Status workflow: 'pending', 'published', 'rejected', 'archived', 'draft'
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected', 'archived', 'draft', 'active', 'inactive'],
      default: 'pending',
      index: true
    },
    // WhatsApp-style notification tracking for newly submitted reviews
    isRead: {
      type: Boolean,
      default: false,
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

// Pre-validate hook to guarantee both naming conventions (reviewerName/studentName, content/comment, title/headline, etc.)
// are synchronized and populated before saving to MongoDB
reviewSchema.pre('validate', function (next) {
  const name = (this.reviewerName || this.studentName || '').trim();
  if (!name) {
    return next(new Error('Please provide reviewer / student name'));
  }
  this.reviewerName = name;
  this.studentName = name;

  const body = (this.content || this.comment || '').trim();
  if (!body) {
    return next(new Error('Please provide review message or description'));
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

  // Normalize status synonyms
  if (this.status === 'active') this.status = 'published';
  if (this.status === 'inactive') this.status = 'draft';

  next();
});

reviewSchema.index({ courseId: 1, status: 1, displayOrder: 1, createdAt: -1 });
reviewSchema.index({ status: 1, isRead: 1 });

module.exports = mongoose.model('Review', reviewSchema);
