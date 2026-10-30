const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Please provide FAQ category'],
      enum: [
        'Fees & Pricing',
        'Payment Plans',
        'Course Prerequisites',
        'Course Access & Recordings',
        'Certificates',
        'Enrollment & Support'
      ],
      trim: true
    },
    question: {
      type: String,
      required: [true, 'Please provide question'],
      trim: true,
      maxlength: [300, 'Question cannot exceed 300 characters']
    },
    answer: {
      type: String,
      required: [true, 'Please provide answer'],
      trim: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

faqSchema.index({ status: 1, category: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('Faq', faqSchema);

