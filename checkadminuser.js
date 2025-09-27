// checkAdmin.js - Run this to verify your admin user exists
const { User } = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/your-db-name');
    
    const adminEmail = 'admin@yourapp.com'; // Use the same email from your creation script
    const user = await User.findOne({ email: adminEmail });
    
    if (user) {
      console.log('✅ Admin user found!');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('Password hash (first 20 chars):', user.password.substring(0, 20) + '...');
      console.log('Created at:', user.createdAt);
    } else {
      console.log('❌ Admin user NOT found in database');
      console.log('Available users:');
      const allUsers = await User.find({}).select('email name role');
      console.log(allUsers);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

checkAdmin();