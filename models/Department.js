const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true, // ✅ unique index already created here
      trim: true, 
      minlength: 2, 
      maxlength: 100 
    },
    description: { 
      type: String, 
      trim: true, 
      maxlength: 500 
    },
    head: { 
      type: String, 
      trim: true, 
      maxlength: 100 
    },
    email: { 
      type: String, 
      trim: true, 
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 
        'Please enter a valid email'
      ]
    },
    phone: { 
      type: String, 
      trim: true 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { 
    timestamps: true 
  }
);

// ✅ Keep only this extra index for queries on isActive
DepartmentSchema.index({ isActive: 1 });

DepartmentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = {
  Department: mongoose.model('Department', DepartmentSchema)
};
