import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;

// ─── MongoDB Connection ────────────────────────────────────────
const connectMongoDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/moodreel';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ MongoDB connected successfully');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Running without MongoDB — caching & recommendations will use fallbacks');
    isConnected = false;
    return false;
  }
};

const isMongoConnected = () => isConnected;

export { mongoose, connectMongoDB, isMongoConnected };
export default connectMongoDB;
