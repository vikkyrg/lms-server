const Certificate = require('../models/Certificate');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate or get certificate for completed course
exports.generateCertificate = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.id;

    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    const totalLessons = await require('../models/Lesson').countDocuments({ courseId });
    const completedLessons = new Set(enrollment.completedLessons.map(lesson => lesson.toString()));
    if (totalLessons === 0 || completedLessons.size < totalLessons
      || enrollment.progress < 100 || enrollment.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You must complete 100% of the course to get a certificate' });
    }

    let certificate = await Certificate.findOne({ studentId, courseId });
    if (!certificate) {
      const certNum = `CERT-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
      try {
        certificate = await Certificate.create({
          certificateNumber: certNum,
          studentId,
          courseId,
          verificationUrl: `/verify-certificate/${certNum}`
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        certificate = await Certificate.findOne({ studentId, courseId });
      }
      enrollment.certificateIssued = true;
      await enrollment.save();
    }

    const populatedCert = await Certificate.findById(certificate._id)
      .populate('studentId', 'name email')
      .populate('courseId', 'title duration videoDuration instructor');

    res.status(200).json({ success: true, certificate: populatedCert });
  } catch (error) {
    next(error);
  }
};

// Verify certificate publicly
exports.verifyCertificate = async (req, res, next) => {
  try {
    const { certificateNumber } = req.params;
    const certificate = await Certificate.findOne({ certificateNumber })
      .populate('studentId', 'name')
      .populate({
        path: 'courseId',
        select: 'title duration videoDuration',
        populate: { path: 'instructor', select: 'name headline' }
      });

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate invalid or not found' });
    }

    res.status(200).json({ success: true, certificate });
  } catch (error) {
    next(error);
  }
};

// Get my certificates
exports.getMyCertificates = async (req, res, next) => {
  try {
    const certificates = await Certificate.find({ studentId: req.user.id })
      .populate('courseId', 'title thumbnail')
      .sort('-issueDate');
    res.status(200).json({ success: true, certificates });
  } catch (error) {
    next(error);
  }
};

const { streamCertificatePdf } = require('../utils/pdfCertificate');

exports.downloadCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findOne({
      _id: req.params.id,
      studentId: req.user.id
    }).populate('studentId', 'name').populate('courseId', 'title duration videoDuration');

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    await streamCertificatePdf(res, certificate);
  } catch (error) {
    next(error);
  }
};

exports.downloadPublicCertificate = async (req, res, next) => {
  try {
    const { certificateNumber } = req.params;
    const certificate = await Certificate.findOne({ certificateNumber })
      .populate('studentId', 'name')
      .populate('courseId', 'title duration videoDuration');

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    await streamCertificatePdf(res, certificate);
  } catch (error) {
    next(error);
  }
};
