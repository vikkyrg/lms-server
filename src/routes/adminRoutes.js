const express = require('express');
const router = express.Router();
const { getDashboardStats, getUsers, updateUserStatus, getEnquiries, createEnquiry, getAuditLogs, getAllPayments } = require('../controllers/adminController');
const { getAdminFaqs, getFaqById, createFaq, updateFaq, deleteFaq } = require('../controllers/faqController');
const { getAdminProjects, getProjectById, createProject, updateProject, updateProjectStatus, deleteProject } = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

router.post('/enquiry', createEnquiry);

router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getUsers);
router.put('/users/:id', protect, authorize('admin'), updateUserStatus);
router.get('/enquiries', protect, authorize('admin'), getEnquiries);
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
