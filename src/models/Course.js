const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide course title'],
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  shortDescription: {
    type: String,
    required: [true, 'Please provide short description'],
    maxlength: 300
  },
  description: {
    type: String,
    required: false,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  thumbnailImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseImage',
    required: false
  },
  previewVideo: {
    type: String,
    default: ''
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
    default: 'All Levels'
  },
  language: {
    type: String,
    default: 'English'
  },
  duration: {
    type: String,
    default: '10 Hours'
  },
  // Admin-controlled heading for the curriculum section on the course
  // details page (e.g. "DevOps Learning Roadmap"). Falls back to a generic
  // title on the frontend when empty so no roadmap text is hardcoded.
  curriculumTitle: {
    type: String,
    default: '',
    trim: true,
    maxlength: 120
  },
  learningOutcomes: [{
    type: String
  }],
  prerequisites: [{
    type: String
  }],
  isFree: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number, // in minor units or INR
    default: 0
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'rejected', 'archived'],
    default: 'published'
  },
  rating: {
    type: Number,
    default: 5.0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  enrollmentCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

courseSchema.pre('save', function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);

