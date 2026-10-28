const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text }) => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
    return;
  }

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.info(`[email:development] ${subject} -> ${to}\n${text}`);
    return;
  }

  throw new Error('Email delivery is not configured');
};

module.exports = { sendEmail };
