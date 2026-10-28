const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getMyPayments, handleWebhook, initiateRefund } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/my', protect, getMyPayments);
router.post('/webhook', handleWebhook);
router.post('/:id/refund', protect, authorize('admin'), initiateRefund);

module.exports = router;
