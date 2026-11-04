const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Course = require('./src/models/Course');
const Category = require('./src/models/Category');
const User = require('./src/models/User');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ role: 'admin' });
    console.log('Admin user:', admin ? { id: admin._id, email: admin.email } : null);

    const categories = await Category.find();
    console.log('Existing Categories:', categories.map(c => ({ id: c._id, name: c.name, slug: c.slug })));

    const courses = await Course.find();
    console.log('Existing Courses:', courses.map(c => ({ id: c._id, title: c.title, status: c.status, slug: c.slug })));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

main();

