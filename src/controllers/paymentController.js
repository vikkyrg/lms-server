const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const mongoose = require('mongoose');

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } catch (err) {
    console.error('Razorpay initialization error:', err.message);
  }
}

// The repository ships placeholder key values so the app boots without secrets.
// Placeholders are not a configured gateway: reject before any network call so
// the student sees a clear message instead of a confusing gateway error.
const isPlaceholderKey = (value) =>
  !value || /placeholder|changeme|your[_-]?key|xxxxx/i.test(String(value));

const gatewayConfigured = () =>
  Boolean(razorpayInstance)
  && !isPlaceholderKey(process.env.RAZORPAY_KEY_ID)
  && !isPlaceholderKey(process.env.RAZORPAY_KEY_SECRET);

const GATEWAY_UNAVAILABLE = {
  success: false,
  message: 'Payment gateway is not configured. Live payment functionality is unavailable.'
};

const activateEnrollment = async (payment) => {
  let enrollment = await Enrollment.findOne({ student: payment.student, course: payment.course });
  if (enrollment) {
    let changed = false;
    if (['rejected', 'expired'].includes(enrollment.status)) {
      enrollment.status = 'pending_approval';
      enrollment.payment = payment._id;
      enrollment.enrolledAt = new Date();
      enrollment.accessStartDate = null;
      enrollment.accessExpiryDate = null;
      changed = true;
    } else if (!enrollment.payment) {
      // Always link the verified payment record so Admin review can see it.
      enrollment.payment = payment._id;
      changed = true;
    }
    if (changed) await enrollment.save();
    return enrollment;
  }

  try {
    enrollment = await Enrollment.create({
      student: payment.student,
      course: payment.course,
      payment: payment._id,
      status: 'pending_approval' // Exact AutoOps School requirement: awaits Admin approval
    });
    await Course.findByIdAndUpdate(payment.course, { $inc: { enrollmentCount: 1 } });
  } catch (error) {
    if (error.code !== 11000) throw error;
    enrollment = await Enrollment.findOne({ student: payment.student, course: payment.course });
  }
  return enrollment;
};

// @desc Create Razorpay payment order
// @route POST /api/v1/payments/create-order
exports.createOrder = async (req, res, next) => {
  try {
    const { courseId, couponCode } = req.body;
    const studentId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    if (course.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Cannot purchase an unpublished course' });
    }

    if (course.isFree || course.price === 0) {
      return res.status(400).json({ success: false, message: 'This course is free. Use free enrollment.' });
    }

    // Check existing enrollment (either active, approved, or pending approval)
    const existing = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      status: { $in: ['approved', 'completed', 'pending_approval'] }
    });
    if (existing) {
      if (existing.status === 'pending_approval') {
        return res.status(400).json({ success: false, message: 'You already have an enrollment awaiting Admin approval for this course.' });
      }
      return res.status(400).json({ success: false, message: 'You already have an active enrollment in this course.' });
    }

    let finalPrice = course.discountPrice > 0 ? course.discountPrice : course.price;
    let discount = 0;

    // Optional coupon logic
    if (couponCode && couponCode.toUpperCase() === 'WELCOME50') {
      discount = Math.round(finalPrice * 0.5);
      finalPrice = finalPrice - discount;
    }

    // Razorpay amounts are in paise (INR * 100)
    const amountInPaise = Math.round(finalPrice * 100);

    if (!gatewayConfigured()) {
      return res.status(503).json(GATEWAY_UNAVAILABLE);
    }

    const order = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });

    const payment = await Payment.create({
      student: studentId,
      course: courseId,
      amount: finalPrice,
      currency: 'INR',
      orderId: order.id,
      status: 'created',
      couponApplied: couponCode || '',
      discountAmount: discount
    });

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id
    });
  } catch (error) {
    next(error);
  }
};

// @desc Verify payment and activate enrollment
// @route POST /api/v1/payments/verify
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentDocId } = req.body;
    const studentId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature
      || (paymentDocId && !mongoose.isValidObjectId(paymentDocId))) {
      return res.status(400).json({ success: false, message: 'Complete payment details are required' });
    }

    const payment = await Payment.findOne({
      ...(paymentDocId ? { _id: paymentDocId } : {}),
      orderId: razorpay_order_id,
      student: studentId
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!gatewayConfigured()) {
      return res.status(503).json(GATEWAY_UNAVAILABLE);
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const signaturesMatch = generatedSignature.length === razorpay_signature.length
      && crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpay_signature));
    if (!signaturesMatch) {
      await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'failed' } });
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    if (payment.status === 'completed') {
      const enrollment = await activateEnrollment(payment);
      return res.status(200).json({
        success: true,
        message: 'Payment was already processed',
        enrollment
      });
    }
    if (payment.status !== 'created') {
      return res.status(409).json({ success: false, message: 'Payment is not eligible for verification' });
    }

    const gatewayOrder = await razorpayInstance.orders.fetch(razorpay_order_id);
    const expectedAmount = Math.round(payment.amount * 100);
    if (gatewayOrder.amount !== expectedAmount || gatewayOrder.currency !== payment.currency) {
      return res.status(400).json({ success: false, message: 'Payment amount or currency mismatch' });
    }

    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, student: studentId, status: 'created' },
      { $set: { paymentId: razorpay_payment_id, signature: razorpay_signature, status: 'completed' } },
      { new: true }
    );
    if (!updatedPayment) {
      return res.status(409).json({ success: false, message: 'Payment was already processed' });
    }

    // Create or activate enrollment
    const enrollment = await activateEnrollment(payment);

    // Non-blocking audit log
    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'PAYMENT_VERIFIED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Payment',
      targetId: payment._id,
      details: { courseId: payment.course, amount: payment.amount, orderId: payment.orderId }
    });

    res.status(200).json({
      success: true,
      message: 'Your payment was successful. Your course enrollment is awaiting Admin approval. You will receive access once your enrollment is approved.',
      status: 'pending_approval',
      enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get student payments
// @route GET /api/v1/payments/my
exports.getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ student: req.user.id })
      .populate('course', 'title thumbnail')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: payments.length, payments });
  } catch (error) {
    next(error);
  }
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !Buffer.isBuffer(req.body)) {
      return res.status(503).json({ success: false, message: 'Webhook is not configured' });
    }
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (!signature || signature.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString('utf8'));
    const paymentEntity = event.payload?.payment?.entity;
    const refundEntity = event.payload?.refund?.entity;
    const paymentId = paymentEntity?.id;
    const orderId = paymentEntity?.order_id;

    if (event.event === 'payment.captured' && paymentId && orderId) {
      const payment = await Payment.findOne({ orderId });
      if (payment && ['created', 'completed'].includes(payment.status)) {
        const updatedPayment = payment.status === 'created'
          ? await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'created' },
            { $set: { paymentId, status: 'completed' } },
            { new: true }
          )
          : payment;
        if (updatedPayment) await activateEnrollment(updatedPayment);
      }
    } else if (event.event === 'payment.failed' && orderId) {
      await Payment.updateOne({ orderId, status: 'created' }, { $set: { status: 'failed' } });
    } else if (event.event === 'refund.processed' && refundEntity?.payment_id) {
      const payment = await Payment.findOne({
        paymentId: refundEntity.payment_id,
        status: { $in: ['completed', 'partially_refunded'] }
      });
      if (payment) {
        await Payment.updateOne(
        { paymentId: refundEntity.payment_id, status: { $in: ['completed', 'partially_refunded'] } },
        {
          $set: {
            status: refundEntity.amount >= Math.round(payment.amount * 100) ? 'refunded' : 'partially_refunded',
            refundAmount: refundEntity.amount / 100,
            refundId: refundEntity.id,
            refundedAt: new Date()
          }
        }
        );
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }
    next(error);
  }
};

exports.initiateRefund = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid payment id' });
    }
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.status !== 'completed' || !payment.paymentId) {
      return res.status(400).json({ success: false, message: 'Payment is not eligible for refund' });
    }
    const refundAmount = amount === undefined ? payment.amount : Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0
      || refundAmount > payment.amount - payment.refundAmount) {
      return res.status(400).json({ success: false, message: 'Refund amount is invalid' });
    }
    if (!gatewayConfigured()) {
      return res.status(503).json(GATEWAY_UNAVAILABLE);
    }
    const refund = await razorpayInstance.payments.refund(payment.paymentId, {
      amount: Math.round(refundAmount * 100),
      notes: { reason: typeof reason === 'string' ? reason.slice(0, 200) : '' }
    });
    payment.refundAmount += refundAmount;
    payment.refundId = refund.id;
    payment.refundReason = typeof reason === 'string' ? reason.slice(0, 200) : '';
    payment.refundedAt = new Date();
    payment.status = payment.refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
    await payment.save();

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'PAYMENT_REFUNDED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Payment',
      targetId: payment._id,
      details: { refundAmount, refundId: refund.id, reason }
    });
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};
