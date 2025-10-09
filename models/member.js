const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  // Section 1: General Information
  generalInfo: {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    citizenshipId: {
      type: String,
      required: true,
      unique: true
    },
    contactNumber: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    permanentAddress: {
      province: {
        type: String,
        required: true
      },
      district: {
        type: String,
        required: true
      },
      palika: {
        type: String,
        required: true
      },
      wardNo: {
        type: Number,
        required: true
      }
    },
    currentAddress: {
      type: String,
      required: true
    }
  },

  // Section 2: Professional Details
  professionalDetails: {
    organizationName: {
      type: String,
      required: true
    },
    designation: {
      type: String,
      required: true
    },
    organizationType: {
      type: String,
      enum: ['Government', 'Private', 'NGO/INGO', 'Academic', 'Freelancer'],
      required: true
    },
    workExperience: {
      type: Number,
      required: true,
      min: 0
    },
    areaOfExpertise: {
      type: [String],
      enum: ['ICT Policy', 'Networking', 'Software', 'Cybersecurity', 'Data / AI', 'e-Governance', 'Other'],
      required: true
    },
    otherExpertise: {
      type: String,
      default: ''
    }
  },

  // Section 3: ICT Forum Membership Details
  membershipDetails: {
    membershipLevel: {
      type: String,
      enum: ['Provincial', 'Local (Palika)', 'Institutional', 'Individual'],
      required: true
    },
    provincePalikaName: {
      type: String,
      required: true
    },
    membershipType: {
      type: String,
      enum: ['General', 'Executive', 'Advisory', 'Lifetime'],
      required: true
    },
    preferredWorkingDomain: {
      type: [String],
      enum: ['Digital Literacy', 'E-Governance', 'Infrastructure', 'Policy & Research', 'Innovation & Startups', 'Cyber Awareness'],
      required: true
    },
    motivation: {
      type: String,
      required: true
    }
  },

  // Section 4: Endorsement
  endorsement: {
    provinceCoordinator: {
      position: {
        type: String,
        default: 'Province / Palika ICT Coordinator'
      },
      name: String,
      signature: String,
      contactNumber: String
    },
    executiveMember: {
      position: {
        type: String,
        default: 'ICT Forum Executive Member'
      },
      name: String,
      signature: String,
      contactNumber: String
    }
  },

  // Section 5: Documents
  documents: {
    citizenshipCopy: {
      filename: String,
      path: String
    },
    photo: {
      filename: String,
      path: String
    },
    recommendationLetter: {
      filename: String,
      path: String
    },
    resume: {
      filename: String,
      path: String
    }
  },

  // Application status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Declaration
  declaration: {
    agreed: {
      type: Boolean,
      default: false,
      required: true
    },
    signature: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
memberSchema.index({ 'generalInfo.citizenshipId': 1 });
memberSchema.index({ 'generalInfo.email': 1 });
memberSchema.index({ status: 1 });
memberSchema.index({ 'membershipDetails.membershipLevel': 1 });

module.exports = mongoose.model('Member', memberSchema);