const mongoose = require('mongoose');

const CATEGORIES = ['academic', 'administrative', 'infrastructure', 'other'];
const STATUSES = ['Received', 'In Process', 'Resolved'];

const MediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const SuggestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    anonymous: { type: Boolean, default: false },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    description: { type: String, required: true, minlength: 10, maxlength: 5000 },
    status: { type: String, enum: STATUSES, default: 'Received', index: true },
    assignedDepartment: { type: String, default: null, index: true },
    assignedTo: { type: String, default: null },
    actionTaken: { type: String, default: null, maxlength: 20000 }, // New field for action taken
    media: { type: [MediaSchema], default: [] }
  },
  { timestamps: true }
);

SuggestionSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  if (obj.anonymous) {
    delete obj.user;
  }
  return obj;
};

// Add validation for assignedDepartment to ensure it exists and is active
SuggestionSchema.pre('save', async function(next) {
  if (this.assignedDepartment && this.isModified('assignedDepartment')) {
    try {
      const Department = mongoose.model('Department');
      const department = await Department.findOne({ 
        name: this.assignedDepartment, 
        isActive: true 
      });
      
      if (!department) {
        const error = new Error('Invalid or inactive department');
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (err) {
      // If Department model doesn't exist yet, skip validation
      if (err.message.includes('Schema hasn\'t been registered')) {
        return next();
      }
      return next(err);
    }
  }
  next();
});

SuggestionSchema.index({ createdAt: -1 });

module.exports = {
  Suggestion: mongoose.model('Suggestion', SuggestionSchema),
  CATEGORIES,
  STATUSES
};