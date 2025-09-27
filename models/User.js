const mongoose = require('mongoose');

const ROLES = ['student', 'teacher', 'staff', 'alumni', 'admin'];

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // unique handled here
    role: { type: String, enum: ROLES, default: 'student', index: true },
    password: { type: String, required: true, minlength: 6 },
    profile: {
      department: { type: String },
      phone: { type: String }
    }
  },
  { timestamps: true }
);

// Removed duplicate index on email

UserSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = {
  User: mongoose.model('User', UserSchema),
  ROLES
};
