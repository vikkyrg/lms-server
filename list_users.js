require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function listUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const users = await User.find({}).select('name email role isEmailVerified');
  console.log('Current users in database:');
  console.log(JSON.stringify(users, null, 2));

  await mongoose.disconnect();
}

listUsers().catch(console.error);

