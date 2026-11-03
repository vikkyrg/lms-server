const express = require('express');
const router = express.Router();
const { getRoadmap, updateRoadmap, resetRoadmap } = require('../controllers/roadmapController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getRoadmap);
router.get('/:slug', getRoadmap);

router.put('/', protect, authorize('admin'), updateRoadmap);
router.put('/:slug', protect, authorize('admin'), updateRoadmap);

router.post('/reset', protect, authorize('admin'), resetRoadmap);

module.exports = router;

