const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    default: 'General Enquiry'
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied'],
    default: 'unread'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Enquiry', enquirySchema);

