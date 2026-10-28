const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const User = require('../models/User');
const Category = require('../models/Category');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Quiz = require('../models/Quiz');
const Assignment = require('../models/Assignment');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db');
    console.log('Connected to DB for seeding...');

    if (process.env.SEED_RESET !== 'true' && await User.exists({})) {
      console.log('Existing users found; seed skipped to preserve the database. Set SEED_RESET=true only for an intentional local reset.');
      await mongoose.disconnect();
      return;
    }

    if (process.env.SEED_RESET === 'true') {
      await User.deleteMany();
      await Category.deleteMany();
      await Course.deleteMany();
      await Module.deleteMany();
      await Lesson.deleteMany();
      await Enrollment.deleteMany();
      await Quiz.deleteMany();
      await Assignment.deleteMany();
      console.warn('SEED_RESET=true: cleared existing LMS data for a local reset.');
    } else {
      console.log('Preserving existing data. Set SEED_RESET=true only for an intentional local reset.');
    }

    // 1. Create Users
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@lms.com',
      password: 'admin123',
      role: 'admin',
      headline: 'Platform Master Architect',
      bio: 'Managing high-standard learning systems worldwide.'
    });

    const student = await User.create({
      name: 'Alex Johnson',
      email: 'student@lms.com',
      password: 'student123',
      role: 'student',
      headline: 'Aspiring Web Developer',
      bio: 'Eager to build production-grade web applications.'
    });

    console.log('Created seed users: admin@lms.com and student@lms.com (passwords: admin123, student123)');

    // 2. Create Categories
    const catDev = await Category.create({
      name: 'Web Development',
      description: 'Master frontend, backend, full stack frameworks, and cloud deployment.',
      icon: 'Code'
    });

    const catData = await Category.create({
      name: 'Data Science & AI',
      description: 'Explore Python, Machine Learning, Deep Learning, and Artificial Intelligence.',
      icon: 'Brain'
    });

    const catDesign = await Category.create({
      name: 'UI/UX Design',
      description: 'Design intuitive, accessible, and delightful digital user experiences.',
      icon: 'Palette'
    });

    const catBusiness = await Category.create({
      name: 'Cloud & DevOps',
      description: 'Docker, Kubernetes, CI/CD pipelines, and AWS cloud management.',
      icon: 'Cloud'
    });

    // 3. Create Courses
    const course1 = await Course.create({
      title: 'Full Stack MERN Mastery: Zero to Production',
      slug: 'full-stack-mern-mastery',
      shortDescription: 'Build scalable modern web applications with React 18, Node.js, Express, and MongoDB.',
      description: 'A comprehensive, end-to-end masterclass covering architecture, REST APIs, state management, security best practices, and production deployment on modern cloud platforms.',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80',
      category: catDev._id,
      instructor: admin._id,
      level: 'Intermediate',
      language: 'English',
      duration: '32 Hours',
      learningOutcomes: [
        'Build and deploy production-grade MERN web applications',
        'Implement robust JWT authentication & role-based authorization',
        'Design efficient MongoDB database schemas and aggregation pipelines',
        'Integrate payment gateways and file storage providers'
      ],
      prerequisites: ['Basic JavaScript, HTML, and CSS fundamentals'],
      isFree: false,
      price: 2999,
      discountPrice: 1499,
      status: 'published',
      rating: 4.9,
      ratingCount: 142,
      enrollmentCount: 1
    });

    const course2 = await Course.create({
      title: 'Modern React & Tailwind CSS Foundations',
      slug: 'modern-react-tailwind-css-foundations',
      shortDescription: 'Learn functional React hooks, component architecture, and modern utility-first CSS for free.',
      description: 'Start your journey into frontend engineering with modern React principles, custom hooks, responsive layouts with Tailwind CSS, and state management.',
      thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      category: catDev._id,
      instructor: admin._id,
      level: 'Beginner',
      language: 'English',
      duration: '14 Hours',
      learningOutcomes: [
        'Understand React virtual DOM and component lifecycles',
        'Master Tailwind CSS utility classes and responsive layouts',
        'Manage local and global state with React hooks and Context'
      ],
      prerequisites: ['Basic HTML and CSS knowledge'],
      isFree: true,
      price: 0,
      discountPrice: 0,
      status: 'published',
      rating: 4.8,
      ratingCount: 89,
      enrollmentCount: 1
    });

    // 4. Create Modules and Lessons for Course 1
    const mod1 = await Module.create({
      title: 'Module 1: Architecture & Backend Foundations',
      courseId: course1._id,
      description: 'Project setup, Node Express architecture, and database models.',
      order: 1
    });

    const mod2 = await Module.create({
      title: 'Module 2: Client Frontend & State Management',
      courseId: course1._id,
      description: 'Setting up Vite, React Router, Tailwind, and Context.',
      order: 2
    });

    const lesson1_1 = await Lesson.create({
      title: '1. Introduction to MERN Stack Architecture',
      courseId: course1._id,
      moduleId: mod1._id,
      description: 'Understanding client-server separation, REST APIs, and MongoDB clustering.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      duration: 15,
      order: 1,
      isPreview: true
    });

    const lesson1_2 = await Lesson.create({
      title: '2. Express REST API Design & Error Handling',
      courseId: course1._id,
      moduleId: mod1._id,
      description: 'Writing maintainable controller-service layers and centralized error handling.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      duration: 25,
      order: 2,
      isPreview: false
    });

    const lesson2_1 = await Lesson.create({
      title: '3. Connecting Frontend with Axios & Secure Tokens',
      courseId: course1._id,
      moduleId: mod2._id,
      description: 'Implementing token storage, auth interceptors, and error boundaries.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      duration: 20,
      order: 3,
      isPreview: false
    });

    // 5. Create Quiz for Course 1
    await Quiz.create({
      title: 'MERN Fundamentals Knowledge Check',
      courseId: course1._id,
      moduleId: mod1._id,
      instructions: 'Answer all 3 questions to assess your conceptual understanding of MERN architecture.',
      timeLimitMinutes: 10,
      passingPercentage: 66,
      questions: [
        {
          questionText: 'Which HTTP method should be used to partially update an existing resource?',
          questionType: 'multiple-choice',
          options: ['GET', 'POST', 'PATCH', 'DELETE'],
          correctAnswer: 'PATCH',
          explanation: 'PATCH applies partial modifications to a resource, whereas PUT typically replaces it.'
        },
        {
          questionText: 'MongoDB is a relational SQL database.',
          questionType: 'true-false',
          options: ['true', 'false'],
          correctAnswer: 'false',
          explanation: 'MongoDB is a document-oriented NoSQL database.'
        },
        {
          questionText: 'What is the role of JWT in stateless authentication?',
          questionType: 'multiple-choice',
          options: [
            'Stores user session in database tables',
            'Digitally signed token asserting user identity without server session state',
            'Encrypts hard drives on server host',
            'Compiles JavaScript code'
          ],
          correctAnswer: 'Digitally signed token asserting user identity without server session state',
          explanation: 'JWTs allow verification of identity statelessly using cryptographic signatures.'
        }
      ]
    });

    // 6. Create Assignment for Course 1
    await Assignment.create({
      title: 'Mini Project: Build a Protected REST API Endpoint',
      courseId: course1._id,
      moduleId: mod1._id,
      instructions: 'Develop an Express route with JWT authorization middleware and validation that returns protected user profile data.',
      totalMarks: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // 7. Enroll Student in Course 2 (Free Course)
    await Enrollment.create({
      student: student._id,
      course: course2._id,
      status: 'active',
      progress: 25,
      completedLessons: []
    });

    console.log('Seed database completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
