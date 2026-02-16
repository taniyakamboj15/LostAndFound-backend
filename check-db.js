import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lost-and-found';

async function check() {
  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const item = await db.collection('items').findOne({});
    console.log('Sample Item Photos:', JSON.stringify(item.photos, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
