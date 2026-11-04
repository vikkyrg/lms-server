const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Course = require('./src/models/Course');
const Module = require('./src/models/Module');
const Lesson = require('./src/models/Lesson');
const Category = require('./src/models/Category');

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Check published courses
    const publishedCourses = await Course.find({ status: 'published' })
      .populate('category', 'name slug');

    console.log(`\nPublished Courses (${publishedCourses.length}):`);
    for (const c of publishedCourses) {
      const moduleCount = await Module.countDocuments({ courseId: c._id });
      const lessonCount = await Lesson.countDocuments({ courseId: c._id });
      console.log(`- [${c.category?.name}] "${c.title}" | Price: Rs.${c.discountPrice || c.price} | Level: ${c.level} | Modules: ${moduleCount} | Lessons: ${lessonCount} | Slug: ${c.slug}`);
    }

    // 2. Check archived courses
    const archivedCourses = await Course.find({ status: 'archived' });
    console.log(`\nArchived Courses (Historical preserved, hidden from catalog: ${archivedCourses.length}):`);
    archivedCourses.forEach(c => console.log(`- "${c.title}" (Status: ${c.status})`));

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nVerification finished');
  }
}

verify();

