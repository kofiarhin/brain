import mongoose from 'mongoose';

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri);
}

export async function disconnectDB() {
  return mongoose.disconnect();
}
