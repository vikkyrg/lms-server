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
      .populate('courseId', 'title instructor');

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
        select: 'title duration',
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

exports.downloadCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findOne({
      _id: req.params.id,
      studentId: req.user.id
    }).populate('studentId', 'name').populate('courseId', 'title');

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificateNumber}.pdf"`);
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 48 });
    document.pipe(res);
    document.rect(0, 0, 842, 595).fill('#f8fafc');
    document.lineWidth(3).strokeColor('#4f46e5').rect(24, 24, 794, 547).stroke();
    document.fillColor('#173563').fontSize(28).font('Helvetica-Bold').text('AutoOps School', { align: 'center' });
    document.moveDown(1);
    document.fillColor('#111827').fontSize(24).text('Certificate of Completion', { align: 'center' });
    document.moveDown(1.5);
    document.fillColor('#6b7280').fontSize(14).font('Helvetica').text('This certifies that', { align: 'center' });
    document.moveDown(0.5);
    document.fillColor('#111827').fontSize(32).font('Helvetica-Bold').text(certificate.studentId.name, { align: 'center' });
    document.moveDown(0.8);
    document.fillColor('#6b7280').fontSize(14).font('Helvetica').text('has successfully completed', { align: 'center' });
    document.moveDown(0.5);
    document.fillColor('#312e81').fontSize(22).font('Helvetica-Bold').text(certificate.courseId.title, { align: 'center' });
    document.moveDown(2);
    document.fillColor('#374151').fontSize(11).font('Helvetica')
      .text(`Certificate number: ${certificate.certificateNumber}`, 72, 485)
      .text(`Issued: ${new Date(certificate.issueDate).toLocaleDateString()}`, 600, 485, { align: 'right' });
    document.end();
  } catch (error) {
    next(error);
  }
};
