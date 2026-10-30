const mongoose = require('mongoose');

const videoTestimonialSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: [true, 'Please provide student name'],
      trim: true
    },
    designation: {
      type: String,
      required: false,
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
      default: 'external'
    },
    videoUrl: {
      type: String,
      required: [true, 'Please provide video URL or uploaded file reference'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: ''
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

