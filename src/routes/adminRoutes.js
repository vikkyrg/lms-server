const express = require('express');
const router = express.Router();
const { getDashboardStats, getUsers, getStudentDetails, updateUserStatus, getEnquiries, createEnquiry, updateEnquiryStatus, deleteEnquiry, getAuditLogs, getAllPayments, getNotificationCounts, markEnrollmentsRead, markEnquiriesRead } = require('../controllers/adminController');
const { getAdminFaqs, getFaqById, createFaq, updateFaq, deleteFaq } = require('../controllers/faqController');
const { getAdminProjects, getProjectById, createProject, updateProject, updateProjectStatus, deleteProject } = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');
const adminWebsitePopupRoutes = require('./adminWebsitePopupRoutes');

router.post('/enquiry', createEnquiry);
router.use('/website-popup', adminWebsitePopupRoutes);

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getUsers);
router.get('/users/:id/details', protect, authorize('admin'), getStudentDetails);
router.put('/users/:id', protect, authorize('admin'), updateUserStatus);
router.get('/enquiries', protect, authorize('admin'), getEnquiries);
router.patch('/enquiries/:id/status', protect, authorize('admin'), updateEnquiryStatus);
router.delete('/enquiries/:id', protect, authorize('admin'), deleteEnquiry);

// Sidebar notification counts (WhatsApp-style unread badges)
router.get('/notifications/counts', protect, authorize('admin'), getNotificationCounts);
router.post('/notifications/enrollments/read', protect, authorize('admin'), markEnrollmentsRead);
router.post('/notifications/enquiries/read', protect, authorize('admin'), markEnquiriesRead);
router.get('/audit-logs', protect, authorize('admin'), getAuditLogs);
router.get('/payments', protect, authorize('admin'), getAllPayments);

// Admin FAQs aliases
router.get('/faqs', protect, authorize('admin'), getAdminFaqs);
router.get('/faqs/:id', protect, authorize('admin'), getFaqById);
router.post('/faqs', protect, authorize('admin'), createFaq);
router.put('/faqs/:id', protect, authorize('admin'), updateFaq);
router.delete('/faqs/:id', protect, authorize('admin'), deleteFaq);

// Admin Projects aliases
router.get('/projects/all', protect, authorize('admin'), getAdminProjects);
router.get('/projects', protect, authorize('admin'), getAdminProjects);
router.get('/projects/:id', protect, authorize('admin'), getProjectById);
router.post('/projects', protect, authorize('admin'), createProject);
router.put('/projects/:id', protect, authorize('admin'), updateProject);
router.patch('/projects/:id/status', protect, authorize('admin'), updateProjectStatus);
router.delete('/projects/:id', protect, authorize('admin'), deleteProject);

module.exports = router;
