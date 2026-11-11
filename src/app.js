const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const curriculumRoutes = require('./routes/curriculumRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const materialRoutes = require('./routes/materialRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const videoTestimonialRoutes = require('./routes/videoTestimonialRoutes');
const faqRoutes = require('./routes/faqRoutes');
const projectRoutes = require('./routes/projectRoutes');
const roadmapRoutes = require('./routes/roadmapRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

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
  if (process.env.JWT_SECRET.trim().length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
}

const allowedOrigins = [process.env.CLIENT_URL, process.env.ADMIN_URL]
  .flatMap(value => (value || '').split(','))
  .map(value => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      throw new Error(`Invalid CORS origin configured: ${value}`);
    }
  });

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('Configure CLIENT_URL or ADMIN_URL with the production frontend origin.');
}

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin is not allowed: ${origin}`));
  },
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    database: databaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/curriculum', curriculumRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/materials', materialRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/video-testimonials', videoTestimonialRoutes);
app.use('/api/v1/faqs', faqRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/roadmap', roadmapRoutes);
app.use('/api/v1/reviews', reviewRoutes);

// Error Handler
app.use(errorHandler);

const PORT = Number(process.env.PORT || 5001);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

let server;

const startServer = async () => {
  await connectDB();
  server = app.listen(PORT, () => {
    console.log(`LMS Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
  server.on('error', (error) => {
    console.error(`Server listen error on port ${PORT}: ${error.message}`);
    process.exit(1);
  });
};

const stopAfterFatalError = (label, error) => {
  console.error(`${label}:`, error);
  if (server?.listening) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
};

startServer().catch((error) => {
  console.error('Backend startup failed; HTTP server was not started:', error.message);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  stopAfterFatalError('Unhandled Rejection', reason);
});

process.on('uncaughtException', (error) => {
  stopAfterFatalError('Uncaught Exception', error);
});

module.exports = app;
