const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const curriculumRoutes = require('./routes/curriculumRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const quizRoutes = require('./routes/quizRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const materialRoutes = require('./routes/materialRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const videoTestimonialRoutes = require('./routes/videoTestimonialRoutes');
const faqRoutes = require('./routes/faqRoutes');
const projectRoutes = require('./routes/projectRoutes');

const app = express();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

const requiredProductionEnv = ['JWT_SECRET', 'MONGODB_URI'];
if (process.env.NODE_ENV === 'production') {
  const missing = requiredProductionEnv.filter(name => !process.env[name] || process.env[name].trim().length === 0);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

// Connect to MongoDB
connectDB();

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
const allowedOrigins = [process.env.CLIENT_URL, process.env.ADMIN_URL].filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174');
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset requests. Please try again later.' }
}));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static folder for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/curriculum', curriculumRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/materials', materialRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/video-testimonials', videoTestimonialRoutes);
app.use('/api/v1/faqs', faqRoutes);
app.use('/api/v1/projects', projectRoutes);

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`LMS Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app;
