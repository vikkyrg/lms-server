const mongoose = require('mongoose');

/**
 * CourseImage Schema for MongoDB Binary Image Storage
 * Stores course thumbnail image binary data directly inside MongoDB
 * with metadata: contentType, filename, size, upload timestamp.
 */
const courseImageSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: false,
      index: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    contentType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    },
    size: {
      type: Number,
      required: true
    },
    data: {
      type: Buffer,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CourseImage', courseImageSchema);

