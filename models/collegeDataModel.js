// models/College.js
const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
  buildings: { type: Number, default: 0 },
  rooms: { type: Number, default: 0 },
  avgSize: { type: Number, default: 0 },
  capacity: { type: Number, default: 0 },
  condition: { 
    type: String, 
    enum: ['Good', 'Poor', 'Needs Repairing', ''], 
    default: '' 
  }
});

const TechResourceSchema = new mongoose.Schema({
  available: { type: Boolean, default: false },
  plans: { type: String, default: '' }
});

const EnrollmentYearSchema = new mongoose.Schema({
  masterEnrollment: { type: Number, default: 0 },
  masterAppeared: { type: Number, default: 0 },
  masterPassed: { type: Number, default: 0 },
  bachelorEnrollment: { type: Number, default: 0 },
  bachelorAppeared: { type: Number, default: 0 },
  bachelorPassed: { type: Number, default: 0 }
});

const ProgramBreakdownSchema = new mongoose.Schema({
  programName: { type: String, required: true },
  totalStudents: { type: Number, default: 0 },
  maleStudents: { type: Number, default: 0 },
  femaleStudents: { type: Number, default: 0 },
  otherStudents: { type: Number, default: 0 }
});

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  position: { type: String, required: true },
  qualification: { type: String },
  experience: { type: Number, default: 0 },
  contactNumber: { type: String },
  email: { type: String },
  department: { type: String },
  employmentType: { 
    type: String, 
    enum: ['Permanent', 'Temporary', 'Contract', 'Part-time'],
    default: 'Permanent'
  }
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  budget: { type: Number, default: 0 },
  startDate: { type: Date },
  expectedEndDate: { type: Date },
  status: { 
    type: String, 
    enum: ['Planning', 'In Progress', 'Completed', 'On Hold'],
    default: 'Planning'
  },
  priority: { 
    type: String, 
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  }
});

const CollegeSchema = new mongoose.Schema({
  // Section 1: General Information
  collegeName: { 
    type: String, 
    required: [true, 'College name is required'],
    trim: true,
    maxLength: [200, 'College name cannot exceed 200 characters']
  },
  campusType: { 
    type: String, 
    required: [true, 'Campus type is required'],
    enum: ['constituent', 'affiliated', 'community', 'private']
  },
  establishmentDate: { 
    type: Date, 
    required: [true, 'Establishment date is required']
  },
  collegeId: { 
    type: String, 
    unique: true,
    sparse: true,
    trim: true 
  },
  principalName: { 
    type: String, 
    required: [true, 'Principal name is required'],
    trim: true 
  },
  principalContact: { 
    type: String, 
    required: [true, 'Principal contact is required'],
    validate: {
      validator: function(v) {
        return /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  principalEmail: { 
    type: String, 
    required: [true, 'Principal email is required'],
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  mainPhone: { type: String, required: true },
  officialEmail: { type: String, required: true },
  adminName: { type: String, trim: true },
  adminMobile: { type: String },
  accountName: { type: String, trim: true },
  accountMobile: { type: String },
  website: { 
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty values
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Please enter a valid website URL'
    }
  },
  contactPersonName: { type: String, trim: true },
  contactPersonDesignation: { type: String, trim: true },
  contactPersonPhone: { type: String },
  contactPersonEmail: { type: String },

  // Section 2: Location Details
  province: { 
    type: String, 
    required: [true, 'Province is required'],
    trim: true 
  },
  district: { 
    type: String, 
    required: [true, 'District is required'],
    trim: true 
  },
  localLevel: { 
    type: String, 
    required: [true, 'Local level is required'],
    trim: true 
  },
  wardNo: { 
    type: Number, 
    required: [true, 'Ward number is required'],
    min: [1, 'Ward number must be at least 1'],
    max: [35, 'Ward number cannot exceed 35']
  },
  streetName: { type: String, trim: true },
  landmark: { type: String, trim: true },
  coordinates: { type: String },
  latitude: { 
    type: Number,
    validate: {
      validator: function(v) {
        if (v === null || v === undefined) return true;
        return v >= -90 && v <= 90;
      },
      message: 'Latitude must be between -90 and 90 degrees'
    }
  },
  longitude: { 
    type: Number,
    validate: {
      validator: function(v) {
        if (v === null || v === undefined) return true;
        return v >= -180 && v <= 180;
      },
      message: 'Longitude must be between -180 and 180 degrees'
    }
  },
  mapsLink: { type: String },

  // Section 3: Infrastructure & Land
  totalLandBigaha: { type: Number, default: 0, min: 0 },
  totalLandKatha: { type: Number, default: 0, min: 0 },
  totalLandDhur: { type: Number, default: 0, min: 0 },
  totalLandRopani: { type: Number, default: 0, min: 0 },
  totalLandAna: { type: Number, default: 0, min: 0 },
  totalLandDaam: { type: Number, default: 0, min: 0 },
  totalLandPaisa: { type: Number, default: 0, min: 0 },
  landAreaSquareMeter: { 
    type: Number, 
    required: [true, 'Land area in square meters is required'],
    min: [1, 'Land area must be at least 1 square meter']
  },
  landAcquisitionDate: { type: Date },
  landTaxStatus: { type: String },
  areaWithLalpurja: { type: Number, default: 0, min: 0 },
  lalpurjaAddress: { type: String },
  areaWithBhogadhikar: { type: Number, default: 0, min: 0 },
  bhogadhikarAddress: { type: String },
  areaLocalGov: { type: Number, default: 0, min: 0 },
  localGovAddress: { type: String },
  areaOtherSources: { type: Number, default: 0, min: 0 },
  otherSourcesAddress: { type: String },
  areaBuildingInfra: { type: Number, default: 0, min: 0 },
  areaPlayground: { type: Number, default: 0, min: 0 },
  areaForestShrubs: { type: Number, default: 0, min: 0 },
  areaPlantationGarden: { type: Number, default: 0, min: 0 },
  areaLeaseContract: { type: Number, default: 0, min: 0 },
  incomeFromLand: { type: Number, default: 0, min: 0 },
  landEncroachment: { 
    type: String, 
    enum: ['yes', 'no', ''],
    default: ''
  },
  encroachmentDetails: { type: String },
  commercialUses: { type: String },
  commercialPlan: { type: String },
  masterPlan: { 
    type: String, 
    enum: ['yes', 'no', 'in_progress', ''],
    default: ''
  },
  masterPlanSuggestions: { type: String },

  // Section 4: Buildings and Rooms
  buildings: {
    classroom: { type: BuildingSchema, default: () => ({}) },
    library: { type: BuildingSchema, default: () => ({}) },
    laboratory: { type: BuildingSchema, default: () => ({}) },
    canteen: { type: BuildingSchema, default: () => ({}) },
    computerRoom: { type: BuildingSchema, default: () => ({}) },
    securityQuarters: { type: BuildingSchema, default: () => ({}) },
    guestHouse: { type: BuildingSchema, default: () => ({}) },
    lectureHalls: { type: BuildingSchema, default: () => ({}) },
    rmcOffice: { type: BuildingSchema, default: () => ({}) },
    facultyRooms: { type: BuildingSchema, default: () => ({}) },
    examHall: { type: BuildingSchema, default: () => ({}) },
    auditorium: { type: BuildingSchema, default: () => ({}) },
    dormitories: { type: BuildingSchema, default: () => ({}) },
    indoorGames: { type: BuildingSchema, default: () => ({}) },
    staffHousing: { type: BuildingSchema, default: () => ({}) },
    gymnasium: { type: BuildingSchema, default: () => ({}) },
    outdoorSports: { type: BuildingSchema, default: () => ({}) },
    counsellingCenter: { type: BuildingSchema, default: () => ({}) },
    parkingLots: { type: BuildingSchema, default: () => ({}) },
    powerSupply: { type: BuildingSchema, default: () => ({}) },
    banksATM: { type: BuildingSchema, default: () => ({}) },
    studentUnion: { type: BuildingSchema, default: () => ({}) },
    medicalCenter: { type: BuildingSchema, default: () => ({}) },
    recreational: { type: BuildingSchema, default: () => ({}) }
  },

  // Section 5: Health, Hygiene & Sanitation
  maleToilets: { type: Number, default: 0, min: 0 },
  femaleToilets: { type: Number, default: 0, min: 0 },
  disabledToilets: { type: Number, default: 0, min: 0 },
  toiletCondition: { 
    type: String, 
    enum: ['Excellent', 'Good', 'Fair', 'Poor', ''],
    default: ''
  },
  ventilation: { type: String },
  lighting: { type: String },
  cleaningFrequency: { type: String },
  sanitaryDisposal: { type: String },
  waterSupplyType: { type: String },
  waterAvailability: { type: String },
  waterQuality: { type: String },
  waterTestingFreq: { type: String },
  drinkingWaterStations: { type: Number, default: 0, min: 0 },
  waterTankCondition: { type: String },
  handwashingStations: { type: Number, default: 0, min: 0 },
  soapSanitizer: { type: String },
  commonAreasCleanliness: { type: String },
  drainageCondition: { type: String },
  cleaningDisinfection: { type: String },
  firstAidKit: { 
    type: String, 
    enum: ['Available', 'Not Available', 'Partially Available', ''],
    default: ''
  },
  healthInspections: { type: String },
  medicalAssistance: { type: String },
  healthAwareness: { type: String },
  emergencyContact: { type: String },
  fireSafety: { type: String },
  fireExitAccess: { type: String },
  wasteDisposalType: { type: String },
  dustbins: { type: Number, default: 0, min: 0 },
  wasteSegregation: { 
    type: String, 
    enum: ['Yes', 'No', 'Partial', ''],
    default: ''
  },
  wasteCollection: { type: String },
  wasteAreaCondition: { type: String },
  recyclingPractices: { type: String },
  greenSpaces: { type: Number, default: 0, min: 0 },
  sustainablePractices: { type: String },
  renewableEnergy: { type: String },

  // Section 6: Academic Programs & Enrollment
  totalFaculties: { type: Number, default: 0, min: 0 },
  programsOffered: { type: String },
  totalStudents: { 
    type: Number, 
    default: 0, 
    min: 0,
    validate: {
      validator: function(v) {
        return v >= (this.maleStudents || 0) + (this.femaleStudents || 0) + (this.otherStudents || 0);
      },
      message: 'Total students must equal or exceed sum of male, female, and other students'
    }
  },
  maleStudents: { type: Number, default: 0, min: 0 },
  femaleStudents: { type: Number, default: 0, min: 0 },
  otherStudents: { type: Number, default: 0, min: 0 },
  programBreakdown: [ProgramBreakdownSchema],

  // Section 7: Project Planning
  immediateConstruction: [{ type: String, trim: true }],
  futureConstruction: [{ type: String, trim: true }],
  priorities: [{ type: String, trim: true }],
  ongoingProjects: [ProjectSchema],

  // Section 8: Academic & Administrative Staff
  academicStaff: [StaffSchema],
  adminStaff: [StaffSchema],

  // Section 9: Educational Tools & Technology
  classroomTech: {
    projectors: { type: TechResourceSchema, default: () => ({}) },
    smartBoards: { type: TechResourceSchema, default: () => ({}) },
    wifi: { type: TechResourceSchema, default: () => ({}) },
    powerBackup: { type: TechResourceSchema, default: () => ({}) },
    microphones: { type: TechResourceSchema, default: () => ({}) }
  },
  libraryResources: {
    physicalBooks: { type: TechResourceSchema, default: () => ({}) },
    eLibrary: { type: TechResourceSchema, default: () => ({}) },
    databases: { type: TechResourceSchema, default: () => ({}) },
    computerStations: { type: TechResourceSchema, default: () => ({}) },
    printingServices: { type: TechResourceSchema, default: () => ({}) }
  },
  labEquipment: {
    scienceLab: { type: TechResourceSchema, default: () => ({}) },
    engineeringLab: { type: TechResourceSchema, default: () => ({}) },
    itSupport: { type: TechResourceSchema, default: () => ({}) },
    simulationSoftware: { type: TechResourceSchema, default: () => ({}) },
    agricultureLab: { type: TechResourceSchema, default: () => ({}) }
  },
  onlineLearning: {
    lms: { type: TechResourceSchema, default: () => ({}) },
    onlineCourses: { type: TechResourceSchema, default: () => ({}) },
    remoteLearning: { type: TechResourceSchema, default: () => ({}) },
    recordedLectures: { type: TechResourceSchema, default: () => ({}) },
    workshops: { type: TechResourceSchema, default: () => ({}) },
    specialProvisions: { type: TechResourceSchema, default: () => ({}) },
    brailleBooks: { type: TechResourceSchema, default: () => ({}) },
    signLanguage: { type: TechResourceSchema, default: () => ({}) }
  },

  // Section 10: Student Enrollment and Graduation (5 years)
  enrollmentData: {
    2077: { type: EnrollmentYearSchema, default: () => ({}) },
    2078: { type: EnrollmentYearSchema, default: () => ({}) },
    2079: { type: EnrollmentYearSchema, default: () => ({}) },
    2080: { type: EnrollmentYearSchema, default: () => ({}) },
    2081: { type: EnrollmentYearSchema, default: () => ({}) }
  },

  // Performance & Management Data
  expenditureFiveYears: { type: String },
  auditReportsFiveYears: { type: String },
  physicalInspectionReports: { type: String },
  
  // Operational Management
  processesStreamlined: { type: String },
  turnaroundTime: { type: String },
  operationalCostReduction: { type: String },
  processingTime: { type: String },
  budgetVariance: { type: String },
  efficiencyReviews: { type: String },
  improvementInitiatives: { type: String },
  sustainabilityAlignment: { type: String },

  // Audit & Risk Management
  commonIrregularities: { type: String },
  resolutionTime: { type: String },
  avgResolutionTime: { type: String },
  irregularitiesQuarter: { type: String },
  avgResolutionDays: { type: String },
  complianceRate: { type: String },
  recurringIssues: { type: String },
  riskMitigation: { type: String },

  // Additional performance metrics...
  stakeholderRating: { type: Number, min: 0, max: 10 },
  communityEngagement: { type: String },
  satisfactionRating: { type: Number, min: 0, max: 10 },
  feedbackSubmissions: { type: Number, default: 0, min: 0 },
  engagementEvents: { type: Number, default: 0, min: 0 },
  newPartnerships: { type: Number, default: 0, min: 0 },
  safetyIncidents: { type: Number, default: 0, min: 0 },

  // Meta fields
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  submittedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  reviewComments: { type: String },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: { type: Date },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
CollegeSchema.index({ collegeName: 1, campusType: 1 });
CollegeSchema.index({ province: 1, district: 1, localLevel: 1 });
CollegeSchema.index({ status: 1, isActive: 1 });
CollegeSchema.index({ submittedAt: -1 });
CollegeSchema.index({ location: '2dsphere' }); // For geospatial queries if implementing location-based searches

// Virtual for total staff count
CollegeSchema.virtual('totalStaffCount').get(function() {
  return (this.academicStaff?.length || 0) + (this.adminStaff?.length || 0);
});

// Virtual for completion percentage
CollegeSchema.virtual('completionPercentage').get(function() {
  const requiredFields = [
    'collegeName', 'campusType', 'establishmentDate', 'principalName',
    'principalContact', 'principalEmail', 'province', 'district', 
    'localLevel', 'wardNo', 'landAreaSquareMeter'
  ];
  
  const completedFields = requiredFields.filter(field => {
    return this[field] && this[field].toString().trim() !== '';
  }).length;
  
  return Math.round((completedFields / requiredFields.length) * 100);
});

// Pre-save middleware
CollegeSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  
  // Validate student count consistency
  const totalCalculated = (this.maleStudents || 0) + (this.femaleStudents || 0) + (this.otherStudents || 0);
  if (this.totalStudents && this.totalStudents < totalCalculated) {
    return next(new Error('Total students cannot be less than sum of gender-wise breakdown'));
  }
  
  next();
});

// Static methods
CollegeSchema.statics.findByLocation = function(province, district, localLevel) {
  const query = { isActive: true };
  if (province) query.province = new RegExp(province, 'i');
  if (district) query.district = new RegExp(district, 'i');
  if (localLevel) query.localLevel = new RegExp(localLevel, 'i');
  
  return this.find(query);
};

CollegeSchema.statics.getStatistics = function() {
  return this.aggregate([
    { $match: { isActive: true, status: 'Approved' } },
    {
      $group: {
        _id: null,
        totalColleges: { $sum: 1 },
        totalStudents: { $sum: '$totalStudents' },
        avgLandArea: { $avg: '$landAreaSquareMeter' },
        campusTypes: {
          $push: '$campusType'
        },
        provinces: {
          $push: '$province'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalColleges: 1,
        totalStudents: 1,
        avgLandArea: { $round: ['$avgLandArea', 2] },
        campusTypeDistribution: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$campusTypes'] },
              as: 'type',
              in: {
                k: '$$type',
                v: {
                  $size: {
                    $filter: {
                      input: '$campusTypes',
                      cond: { $eq: ['$$this', '$$type'] }
                    }
                  }
                }
              }
            }
          }
        },
        provinceDistribution: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$provinces'] },
              as: 'province',
              in: {
                k: '$$province',
                v: {
                  $size: {
                    $filter: {
                      input: '$provinces',
                      cond: { $eq: ['$$this', '$$province'] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]);
};

// Instance methods
CollegeSchema.methods.calculateInfrastructureScore = function() {
  const buildingTypes = Object.keys(this.buildings);
  const totalBuildings = buildingTypes.reduce((sum, type) => {
    return sum + (this.buildings[type]?.buildings || 0);
  }, 0);
  
  const goodConditionBuildings = buildingTypes.reduce((sum, type) => {
    return sum + (this.buildings[type]?.condition === 'Good' ? (this.buildings[type]?.buildings || 0) : 0);
  }, 0);
  
  return totalBuildings > 0 ? Math.round((goodConditionBuildings / totalBuildings) * 100) : 0;
};

const College = mongoose.model('College', CollegeSchema);

module.exports = College;