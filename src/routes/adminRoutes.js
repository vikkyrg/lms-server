const express = require('express');
const router = express.Router();
const { getDashboardStats, getUsers, updateUserStatus, getEnquiries, createEnquiry, getAuditLogs, getAllPayments } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.post('/enquiry', createEnquiry);

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getUsers);
router.put('/users/:id', protect, authorize('admin'), updateUserStatus);
router.get('/enquiries', protect, authorize('admin'), getEnquiries);
router.get('/audit-logs', protect, authorize('admin'), getAuditLogs);
router.get('/payments', protect, authorize('admin'), getAllPayments);

module.exports = router;
