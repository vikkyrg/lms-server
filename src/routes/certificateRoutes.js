const express = require('express');
const router = express.Router();
const { generateCertificate, verifyCertificate, getMyCertificates, downloadCertificate } = require('../controllers/certificateController');
const { protect } = require('../middleware/auth');

router.post('/generate', protect, generateCertificate);
router.get('/verify/:certificateNumber', verifyCertificate);
router.get('/my', protect, getMyCertificates);
router.get('/:id/download', protect, downloadCertificate);

module.exports = router;
