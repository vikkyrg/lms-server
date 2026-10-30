const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
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
    batch: {
      type: String,
      default: '',
      trim: true
    },
    completionDate: {
      type: String,
      default: '',
      trim: true
    },
    review: {
      type: String,
      required: [true, 'Please provide student review'],
      maxlength: [500, 'Review cannot exceed 500 characters'],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Please provide rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5
    },
    image: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

testimonialSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

module.exports = mongoose.model('Testimonial', testimonialSchema);

