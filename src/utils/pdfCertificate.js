const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Streams a premium, print-ready landscape A4 certificate to Express response
 * @param {import('express').Response} res 
 * @param {any} certificate Populated certificate object
 */
function streamCertificatePdf(res, certificate) {
  return new Promise((resolve, reject) => {
    try {
      const studentName = certificate.studentId?.name || 'Valued Student';
      const courseTitle = certificate.courseId?.title || 'Course of Study';
      const formatDuration = (course) => {
        if (!course) return 'Duration not specified';
        if (course.videoDuration !== undefined && course.videoDuration !== null && course.videoDuration !== '') {
          return `${course.videoDuration} Hours`;
        }
        if (course.duration) {
          const match = String(course.duration).match(/(\d+(\.\d+)?)/);
          if (match) {
            return `${match[1]} Hours`;
          }
          return course.duration;
        }
        return 'Duration not specified';
      };

      const courseDuration = formatDuration(certificate.courseId);
      const certificateNumber = certificate.certificateNumber;
      const issueDate = certificate.issueDate || new Date();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${certificateNumber}.pdf"`);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        info: {
          Title: `AutoOps School Certificate of Completion - ${studentName}`,
          Author: 'AutoOps School',
          Subject: `${courseTitle} Certificate`,
          Keywords: 'AutoOps School, Certificate of Completion, DevOps, IT Training, Credential'
        }
      });

      doc.pipe(res);
      doc.on('end', resolve);
      doc.on('error', reject);

      const width = 842;
      const height = 595;

      // 1. Base clean white / ivory background
      doc.rect(0, 0, width, height).fill('#FCFCFD');

      // 2. Corner decorative trim (Subtle Warm Gold Accents)
      doc.save();
      doc.fillColor('#F4D36B');
      doc.polygon([0, 0], [42, 0], [0, 42]).fill();
      doc.polygon([width, 0], [width - 42, 0], [width, 42]).fill();
      doc.polygon([0, height], [42, height], [0, height - 42]).fill();
      doc.polygon([width, height], [width - 42, height], [width, height - 42]).fill();
      doc.restore();

      // 3. Borders: Primary Deep Navy + Subtle Gold + Fine Accent
      // Outer primary navy border
      doc.lineWidth(3).strokeColor('#102747').rect(24, 24, width - 48, height - 48).stroke();

      // Middle warm gold border
      doc.lineWidth(1.2).strokeColor('#D4AF37').rect(32, 32, width - 64, height - 64).stroke();

      // Inner faint navy line
      doc.save();
      doc.lineWidth(0.5).strokeColor('#173563').opacity(0.3).rect(36, 36, width - 72, height - 72).stroke();
      doc.restore();

      // Corner accent ornaments
      const corners = [
        [32, 32],
        [width - 32, 32],
        [32, height - 32],
        [width - 32, height - 32]
      ];
      doc.save();
      doc.fillColor('#D4AF37');
      corners.forEach(([cx, cy]) => {
        doc.circle(cx, cy, 3.5).fill();
      });
      doc.restore();

      // 4. Subtle Background Watermark (AutoOps School Logo)
      // Checks local server assets first, falls back to client directory if needed
      const logoPaths = [
        path.join(__dirname, '../../assets/logo.png'),
        path.join(__dirname, '../assets/logo.png'),
        path.join(__dirname, '../../../client/src/assests/logo.png'),
        path.join(__dirname, '../../../client/public/logo.png')
      ];
      const logoPath = logoPaths.find(p => fs.existsSync(p));

      if (logoPath) {
        doc.save();
        // 4-7% opacity as required by specification
        doc.opacity(0.048);
        const wmWidth = 400;
        doc.image(logoPath, (width - wmWidth) / 2, (height - 260) / 2 + 10, { width: wmWidth });
        doc.restore();
      }

      // 5. Header Section
      let headerTextY = 64;
      if (logoPath) {
        try {
          doc.image(logoPath, (width - 70) / 2, 46, { width: 70 });
          headerTextY = 104;
        } catch (e) {
          console.error('Failed to draw header logo:', e);
        }
      }

      doc.fillColor('#102747')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('AUTOOPS SCHOOL', 0, headerTextY, { align: 'center', characterSpacing: 3 });

      doc.fillColor('#173563')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('CERTIFICATE OF COMPLETION', 0, headerTextY + 20, { align: 'center', characterSpacing: 2 });

      // Subtle decorative gold separator
      const sepY = headerTextY + 50;
      doc.save();
      doc.strokeColor('#D4AF37').lineWidth(0.8);
      doc.moveTo(width / 2 - 120, sepY).lineTo(width / 2 - 14, sepY).stroke();
      doc.moveTo(width / 2 + 14, sepY).lineTo(width / 2 + 120, sepY).stroke();
      doc.fillColor('#D4AF37');
      doc.polygon([width / 2, sepY - 4], [width / 2 + 4, sepY], [width / 2, sepY + 4], [width / 2 - 4, sepY]).fill();
      doc.restore();

      // 6. Main Content Section
      const mainY = sepY + 16;
      doc.fillColor('#64748B')
        .font('Helvetica')
        .fontSize(10.5)
        .text('THIS CERTIFICATE IS PROUDLY PRESENTED TO', 0, mainY, { align: 'center', characterSpacing: 1.5 });

      // Student Name in large elegant typography
      const nameY = mainY + 22;
      doc.fillColor('#102747')
        .font('Helvetica-Bold')
        .fontSize(30)
        .text(studentName, 50, nameY, { align: 'center', width: width - 100 });

      // Name underline accent in gold
      const textWidth = Math.min(doc.widthOfString(studentName), width - 180);
      const nameLineY = nameY + 36;
      doc.save();
      doc.strokeColor('#D4AF37').lineWidth(1.2);
      doc.moveTo((width - textWidth) / 2 - 16, nameLineY).lineTo((width + textWidth) / 2 + 16, nameLineY).stroke();
      doc.restore();

      // Course statement
      const stmtY = nameLineY + 14;
      doc.fillColor('#64748B')
        .font('Helvetica')
        .fontSize(10)
        .text('for successfully completing the course curriculum and practical evaluations for', 0, stmtY, { align: 'center' });

      // Course Title
      const titleY = stmtY + 18;
      doc.fillColor('#173563')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(courseTitle, 50, titleY, { align: 'center', width: width - 100 });

      // Duration / Learning Hours
      const detailsY = titleY + 26;
      const durationText = courseDuration
        ? `Curriculum Duration: ${courseDuration} • Practical Exercises & Technical Evaluation Completed`
        : 'Comprehensive Curriculum, Practical Exercises & Technical Evaluation Completed';
      doc.fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9.5)
        .text(durationText, 0, detailsY, { align: 'center' });

      // 7. Bottom Section (Balanced Two-Column Footer: Identification & Verification)
      const footerY = 460;

      // Bottom Section Background Card
      doc.save();
      doc.fillColor('#F8FAFC').opacity(0.88);
      doc.roundedRect(48, footerY - 10, width - 96, 92, 8).fill();
      doc.lineWidth(0.6).strokeColor('#E2E8F0').opacity(1).roundedRect(48, footerY - 10, width - 96, 92, 8).stroke();
      doc.restore();

      // --- Left Column: Certificate Identifier & Issue Date ---
      const leftColX = 66;
      doc.fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('CERTIFICATE IDENTIFIER', leftColX, footerY + 6, { characterSpacing: 1 });

      doc.fillColor('#102747')
        .font('Courier-Bold')
        .fontSize(12)
        .text(certificateNumber || 'CERT-N/A', leftColX, footerY + 20);

      doc.fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('ISSUE DATE', leftColX, footerY + 44, { characterSpacing: 1 });

      const dateStr = issueDate
        ? new Date(issueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.fillColor('#102747')
        .font('Helvetica')
        .fontSize(10.5)
        .text(dateStr, leftColX, footerY + 58);

      // --- Right Column: Official Verification & Security Badge ---
      const badgeWidth = 220;
      const badgeHeight = 36;
      const badgeX = width - 48 - 18 - badgeWidth;
      const badgeY = footerY + 18;

      doc.save();
      doc.fillColor('#ECFDF5').roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6).fill();
      doc.lineWidth(0.8).strokeColor('#A7F3D0').roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6).stroke();
      doc.restore();

      doc.fillColor('#047857')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('● VERIFIED & AUTHENTICATED', badgeX, badgeY + 12, { width: badgeWidth, align: 'center', characterSpacing: 0.5 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  streamCertificatePdf
};

