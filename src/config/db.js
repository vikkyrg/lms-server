const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const connectDB = async () => {
  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB connection lost; waiting for the driver to reconnect.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB connection restored.');
  });
  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error: ${error.message}`);
  });

  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db',
      {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 15000,
        connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 15000,
        socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
