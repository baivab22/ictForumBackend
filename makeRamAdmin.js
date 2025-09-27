// makeRamAdmin.js - Change Ram's role to admin
const { User } = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

async function makeRamAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/your-db-name');
    
    const ramEmail = 'ram12@gmail.com';
    
    console.log('Finding Ram...');
    const user = await User.findOne({ email: ramEmail });
    
    if (!user) {
      console.log('❌ Ram not found');
      return;
    }
    
    console.log('Found user:');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Current Role:', user.role);
    
    console.log('Updating role to admin...');
    const result = await User.updateOne(
      { email: ramEmail },
      { $set: { role: 'admin' } }
    );
    
    if (result.modifiedCount === 1) {
      console.log('✅ Successfully updated Ram to admin!');
      
      // Verify the change
      const updatedUser = await User.findOne({ email: ramEmail });
      console.log('New role:', updatedUser.role);
      
      console.log('\nYou can now login with:');
      console.log('Email:', ramEmail);
      console.log('Password: [whatever password Ram registered with]');
      
    } else {
      console.log('❌ Update failed');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

makeRamAdmin();