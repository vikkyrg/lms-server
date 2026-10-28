const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String
  },
  signature: {
    type: String
  },
  status: {
    type: String,
    enum: ['created', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'created'
  },
  paymentMethod: {
    type: String,
    default: 'Razorpay'
  },
  couponApplied: {
    type: String
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundId: String,
  refundReason: String,
  refundedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
