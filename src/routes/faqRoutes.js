const express = require('express');
const router = express.Router();
const {
  getPublicFaqs,
  getAdminFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq
} = require('../controllers/faqController');
const { protect, authorize } = require('../middleware/auth');

// Public endpoint for public FAQ page
router.get('/', getPublicFaqs);

// Admin protected endpoints
router.get('/admin', protect, authorize('admin'), getAdminFaqs);
router.get('/admin/:id', protect, authorize('admin'), getFaqById);
router.post('/', protect, authorize('admin'), createFaq);
router.put('/:id', protect, authorize('admin'), updateFaq);
router.delete('/:id', protect, authorize('admin'), deleteFaq);

module.exports = router;

