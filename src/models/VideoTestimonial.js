const mongoose = require('mongoose');

/**
 * VideoTestimonial Schema
 * Supports MongoDB GridFS raw binary video storage, MongoDB binary thumbnail storage,
 * and external video links (YouTube/Vimeo).
 */
const videoTestimonialSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: [true, 'Please provide student name'],
      trim: true
    },
    designation: {
      type: String,
      default: '',
      trim: true
    },
    courseName: {
      type: String,
      default: '',
      trim: true
    },
    videoSourceType: {
      type: String,
      enum: ['upload', 'external'],
      required: true,
      default: 'upload'
    },
    // GridFS File reference for uploaded video in MongoDB
    videoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    videoMimeType: {
      type: String,
      default: 'video/mp4'
    },
    videoSize: {
      type: Number,
      default: 0
    },
    // External link or virtual/generated streaming endpoint
    videoUrl: {
      type: String,
      default: '',
      trim: true
    },
    // Binary thumbnail stored directly in MongoDB document (or external/gridfs URL)
    thumbnailData: {
      type: Buffer,
      default: null
    },
    thumbnailMimeType: {
      type: String,
      default: ''
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true
    },
    duration: {
      type: Number, // in seconds
      default: 0
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

videoTestimonialSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

module.exports = mongoose.model('VideoTestimonial', videoTestimonialSchema);
