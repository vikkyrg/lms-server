const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide project title'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
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
      trim: true,
      maxlength: [400, 'Short description cannot exceed 400 characters']
    },
    description: {
      type: String,
      required: [true, 'Please provide detailed description'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Please provide project category'],
      default: 'DevOps',
      trim: true
    },
    image: {
      type: String,
      default: ''
    },
    imageAlt: {
      type: String,
      default: '',
      trim: true
    },
    technologies: {
      type: [String],
      default: []
    },
    learningOutcomes: {
      type: [String],
      default: []
    },
    objectives: {
      type: [String],
      default: []
    },
    prerequisites: {
      type: String,
      default: '',
      trim: true
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate'
    },
    estimatedDuration: {
      type: String,
      default: '2-3 weeks',
      trim: true
    },
    githubUrl: {
      type: String,
      default: '',
      trim: true
    },
    liveDemoUrl: {
      type: String,
      default: '',
      trim: true
    },
    videoUrl: {
      type: String,
      default: '',
      trim: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published'
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

// Auto-generate slug from title before validation if not explicitly given
projectSchema.pre('validate', function (next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    const baseSlug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.slug = baseSlug || `project-${Date.now()}`;
  }
  next();
});

projectSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
