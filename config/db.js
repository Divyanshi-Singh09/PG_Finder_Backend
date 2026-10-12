const mongoose = require('mongoose');

// Disable command buffering so queries return immediately or use fallback instead of hanging for 10s
mongoose.set('bufferCommands', false);

let isMongoConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pgfinder', {
      serverSelectionTimeoutMS: 2000,
    });
    isMongoConnected = true;
    console.log(`[PGFinder MongoDB] Connected to ${conn.connection.host}`);
  } catch (error) {
    isMongoConnected = false;
    console.log(`[PGFinder Database Note] Local MongoDB not active (${error.message}). Switched to instant local dev database engine.`);
  }
};

const checkDBConnection = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = { connectDB, checkDBConnection };
