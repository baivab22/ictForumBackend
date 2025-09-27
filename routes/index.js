const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { User, ROLES } = require('../models/User');
const { Suggestion, CATEGORIES, STATUSES } = require('../models/Suggestion');
const { Department } = require('../models/Department');
const { verifyJWT, optionalAuth, requireRole } = require('../middleware/auth');


const College = require('../models/collegeDataModel');

const router = express.Router();

// const router = express();

/**
 * Multer setup for media uploads (images/videos)
 */
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error('Only images and videos are allowed'));
  }
});

/**
 * Helpers
 */
function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function pick(obj, fields) {
  return fields.reduce((acc, k) => {
    if (Object.prototype.hasOwnProperty.call(obj, k)) acc[k] = obj[k];
    return acc;
  }, {});
}

/**
 * Auth Routes
 */
// Register (public). Role forced to non-admin unless controlled by admins in future.
router.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password are required' });
    }
    
    // FIXED: Removed the "&& role !== 'admin'" restriction
    const normalizedRole = ROLES.includes(role) ? role : 'student';

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hash, role: normalizedRole });
    const token = signToken(user);
    return res.status(201).json({ user: user.toSafeJSON(), token });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});


// Login
// Temporary debug version of your login route
router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('Login attempt for email:', email); // Debug log
    
    if (!email || !password) return res.status(400).json({ message: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    console.log('User found:', user ? 'YES' : 'NO'); // Debug log
    
    if (!user) {
      console.log('User not found in database'); // Debug log
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User role:', user.role); // Debug log
    console.log('Stored password hash:', user.password.substring(0, 10) + '...'); // Debug log (first 10 chars)

    const ok = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', ok); // Debug log
    
    if (!ok) {
      console.log('Password comparison failed'); // Debug log
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);
    console.log('Login successful for:', user.email); // Debug log
    return res.json({ user: user.toSafeJSON(), token });
  } catch (err) {
    console.error('Login error:', err); // Debug log
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Logout (stateless)
router.post('/api/auth/logout', verifyJWT, async (_req, res) => {
  return res.json({ message: 'Logged out (client should discard token)' });
});

/**
 * Department Routes (Public - Read Only)
 */
// Get all active departments (public access for form dropdowns)
router.get('/api/departments', async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 });
    return res.json({ departments });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch departments', error: err.message });
  }
});

/**
 * Suggestion Routes
 */

// Create suggestion (anonymous or authenticated) with optional media files
// Accepts multipart/form-data with fields: category, description, anonymous, actionTaken
// and files under field name "media"
router.post('/api/suggestions', upload.array('media', 5), async (req, res) => {
  try {
    const { category, description, assignedDepartment, actionTaken } = req.body || {};
    const anonymous = String(req.body?.anonymous || 'true') === 'true';

    if (!category || !description) {
      return res.status(400).json({ message: 'category and description are required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` });
    }
    if (!anonymous && !req.user) {
      return res.status(401).json({ message: 'Authentication required for non-anonymous submission' });
    }

    // Validate department if provided
    if (assignedDepartment) {
      const department = await Department.findOne({ name: assignedDepartment, isActive: true });
      if (!department) {
        return res.status(400).json({ message: 'Invalid or inactive department' });
      }
    }

    // Validate actionTaken length if provided
    if (actionTaken && actionTaken.length > 20000) {
      return res.status(400).json({ message: 'Action taken cannot exceed 20000 characters' });
    }

    const files = (req.files || []).map((f) => ({
      type: f.mimetype.startsWith('image/') ? 'image' : 'video',
      url: `${req.protocol}://${req.get('host')}/uploads/${f.filename}`,
      filename: f.filename,
      mimetype: f.mimetype,
      size: f.size
    }));

    console.log(assignedDepartment, "assigned department");

    const doc = await Suggestion.create({
      user: anonymous ? undefined : req.user?.id,
      anonymous,
      category,
      description,
      media: files,
      assignedDepartment,
      actionTaken: actionTaken || null // Include actionTaken if provided
    });
    return res.status(201).json({ suggestion: doc.toPublicJSON() });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create suggestion', error: err.message });
  }
});

// List current user's suggestions
router.get('/api/suggestions/my', verifyJWT, async (req, res) => {
  try {
    const docs = await Suggestion.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json({ suggestions: docs.map((d) => d.toPublicJSON()) });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list suggestions', error: err.message });
  }
});

// Track suggestion status by ID (public)
router.get('/api/suggestions/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid suggestion id' });
    const doc = await Suggestion.findById(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const minimal = {
      id: doc._id,
      status: doc.status,
      category: doc.category,
      actionTaken: doc.actionTaken, // Include actionTaken in tracking
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    return res.json({ suggestion: minimal });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to track suggestion', error: err.message });
  }
});

// Public transparency: list resolved suggestions (paginated)
router.get('/api/public/resolved', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Suggestion.find({ status: 'Resolved' }).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Suggestion.countDocuments({ status: 'Resolved' })
    ]);

    return res.json({
      page,
      limit,
      total,
      suggestions: items.map((d) => d.toPublicJSON())
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch resolved suggestions', error: err.message });
  }
});

/**
 * Admin Routes
 */
router.get('/api/admin/suggestions', async (req, res) => {
  try {
    const {
      category,
      status,
      assignedDepartment,
      q,
      from,
      to,
      page: pageStr,
      limit: limitStr
    } = req.query;

    const page = Math.max(parseInt(pageStr || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (status && STATUSES.includes(status)) filter.status = status;
    if (assignedDepartment) filter.assignedDepartment = assignedDepartment;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (q) {
      // Search in both description and actionTaken fields
      filter.$or = [
        { description: { $regex: q, $options: 'i' } },
        { actionTaken: { $regex: q, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      Suggestion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Suggestion.countDocuments(filter)
    ]);

    return res.json({
      page,
      limit,
      total,
      suggestions: items.map((d) => d.toPublicJSON())
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch admin suggestions', error: err.message });
  }
});

// Update suggestion fields: status, category, assignedDepartment, assignedTo, actionTaken
router.patch('/api/admin/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid suggestion id' });

    const updates = pick(req.body || {}, ['status', 'category', 'assignedDepartment', 'assignedTo', 'actionTaken']);
    
    if (updates.status && !STATUSES.includes(updates.status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${STATUSES.join(', ')}` });
    }
    if (updates.category && !CATEGORIES.includes(updates.category)) {
      return res.status(400).json({ message: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` });
    }

    // Validate actionTaken length if provided
    if (updates.actionTaken && updates.actionTaken.length > 2000) {
      return res.status(400).json({ message: 'Action taken cannot exceed 20000 characters' });
    }

    // Validate department if being updated
    if (updates.assignedDepartment) {
      const department = await Department.findOne({ name: updates.assignedDepartment, isActive: true });
      if (!department) {
        return res.status(400).json({ message: 'Invalid or inactive department' });
      }
    }

    const doc = await Suggestion.findByIdAndUpdate(id, updates, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    return res.json({ suggestion: doc.toPublicJSON() });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update suggestion', error: err.message });
  }
});

router.delete('/api/admin/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid suggestion id' });
    const result = await Suggestion.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: 'Not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete suggestion', error: err.message });
  }
});

/**
 * Admin Department CRUD Routes
 */

// Get all departments (admin only - includes inactive)
router.get('/api/admin/departments', async (req, res) => {
  try {
    const {
      q,
      isActive,
      page: pageStr,
      limit: limitStr
    } = req.query;

    const page = Math.max(parseInt(pageStr || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { head: { $regex: q, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      Department.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Department.countDocuments(filter)
    ]);

    return res.json({
      page,
      limit,
      total,
      departments: items
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch departments', error: err.message });
  }
});

// Create new department
router.post('/api/admin/departments', async (req, res) => {
  try {
    const { name, description, head, email, phone, isActive } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    // Check if department name already exists
    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: 'Department name already exists' });
    }

    const department = await Department.create({
      name: name.trim(),
      description,
      head,
      email,
      phone,
      isActive: isActive !== false // Default to true unless explicitly set to false
    });

    return res.status(201).json({ department });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Department name already exists' });
    }
    return res.status(500).json({ message: 'Failed to create department', error: err.message });
  }
});

// Get single department
router.get('/api/admin/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid department id' });

    const department = await Department.findById(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    return res.json({ department });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch department', error: err.message });
  }
});

// Update department
router.put('/api/admin/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid department id' });

    const updates = pick(req.body || {}, ['name', 'description', 'head', 'email', 'phone', 'isActive']);
    
    if (updates.name) {
      updates.name = updates.name.trim();
      // Check if name already exists for another department
      const existing = await Department.findOne({ name: updates.name, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ message: 'Department name already exists' });
      }
    }

    const department = await Department.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    return res.json({ department });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Department name already exists' });
    }
    return res.status(500).json({ message: 'Failed to update department', error: err.message });
  }
});

// Delete department (soft delete by setting isActive to false)
router.delete('/api/admin/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid department id' });
    
    // Check if department is assigned to any suggestions
    const suggestionsCount = await Suggestion.countDocuments({ assignedDepartment: { $exists: true, $ne: null } });
    const department = await Department.findById(id);
    
    if (!department) return res.status(404).json({ message: 'Department not found' });
    
    if (suggestionsCount > 0) {
      // If department has suggestions, soft delete (deactivate)
      department.isActive = false;
      await department.save();
      return res.json({ message: 'Department deactivated (has associated suggestions)', department });
    } else {
      // If no suggestions, hard delete
      await Department.findByIdAndDelete(id);
      return res.json({ message: 'Department deleted permanently' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete department', error: err.message });
  }
});

// Analytics & Reports
router.get('/api/admin/reports/summary', async (_req, res) => {
  try {
    // Counts by status
    const byStatus = await Suggestion.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Counts by category
    const byCategory = await Suggestion.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Counts by department
    const byDepartment = await Suggestion.aggregate([
      { $match: { assignedDepartment: { $ne: null } } },
      { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } }
    ]);

    // Monthly counts (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthly = await Suggestion.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Department statistics
    const departmentStats = await Department.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Action taken statistics (suggestions with action taken vs without)
    const actionStats = await Suggestion.aggregate([
      {
        $group: {
          _id: null,
          withAction: { $sum: { $cond: [{ $ne: ['$actionTaken', null] }, 1, 0] } },
          withoutAction: { $sum: { $cond: [{ $eq: ['$actionTaken', null] }, 1, 0] } }
        }
      }
    ]);

    return res.json({
      byStatus,
      byCategory,
      byDepartment,
      monthly,
      departmentStats: departmentStats[0] || { total: 0, active: 0 },
      actionStats: actionStats[0] || { withAction: 0, withoutAction: 0 }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to build report', error: err.message });
  }
});

module.exports = router;





router.get('/api/colleges/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid college ID' });
    }

    const college = await College.findById(id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    // Calculate key performance indicators
    const kpis = {
      // Academic Performance
      studentTeacherRatio: college.totalStudents && college.totalStaffCount > 0 
        ? Math.round(college.totalStudents / college.totalStaffCount * 100) / 100 
        : 0,
      
      // Infrastructure Efficiency
      infrastructureScore: college.calculateInfrastructureScore(),
      landUtilization: college.landAreaSquareMeter > 0 
        ? Math.round((college.areaBuildingInfra / college.landAreaSquareMeter) * 100 * 100) / 100 
        : 0,
      
      // Capacity Utilization
      capacityUtilization: (() => {
        const totalCapacity = Object.values(college.buildings).reduce((sum, building) => 
          sum + (building.capacity || 0), 0);
        return totalCapacity > 0 ? Math.round((college.totalStudents / totalCapacity) * 100 * 100) / 100 : 0;
      })(),

      // Gender Balance
      genderBalance: {
        male: college.totalStudents > 0 ? Math.round((college.maleStudents / college.totalStudents) * 100 * 100) / 100 : 0,
        female: college.totalStudents > 0 ? Math.round((college.femaleStudents / college.totalStudents) * 100 * 100) / 100 : 0,
        other: college.totalStudents > 0 ? Math.round((college.otherStudents / college.totalStudents) * 100 * 100) / 100 : 0
      },

      // Technology Readiness
      techReadiness: (() => {
        const techItems = [
          college.classroomTech.projectors.available,
          college.classroomTech.smartBoards.available,
          college.classroomTech.wifi.available,
          college.libraryResources.eLibrary.available,
          college.onlineLearning.lms.available
        ];
        const available = techItems.filter(Boolean).length;
        return Math.round((available / techItems.length) * 100 * 100) / 100;
      })(),

      // Completion Rate
      completionRate: college.completionPercentage
    };

    // 5-year enrollment trends
    const enrollmentTrends = Object.entries(college.enrollmentData || {}).map(([year, data]) => ({
      year: parseInt(year),
      totalEnrollment: data.masterEnrollment + data.bachelorEnrollment,
      masterEnrollment: data.masterEnrollment,
      bachelorEnrollment: data.bachelorEnrollment,
      totalAppeared: data.masterAppeared + data.bachelorAppeared,
      totalPassed: data.masterPassed + data.bachelorPassed,
      passRate: data.masterAppeared + data.bachelorAppeared > 0 
        ? Math.round(((data.masterPassed + data.bachelorPassed) / (data.masterAppeared + data.bachelorAppeared)) * 100 * 100) / 100 
        : 0
    })).sort((a, b) => a.year - b.year);

    // Resource gaps analysis
    const resourceGaps = {
      criticalInfrastructure: Object.entries(college.buildings)
        .filter(([_, building]) => building.condition === 'Poor' || building.condition === 'Needs Repairing')
        .map(([type, building]) => ({ type, condition: building.condition, buildings: building.buildings })),
      
      technologyGaps: Object.entries({
        ...college.classroomTech,
        ...college.libraryResources,
        ...college.labEquipment,
        ...college.onlineLearning
      }).filter(([_, resource]) => !resource.available)
        .map(([type, resource]) => ({ type, plans: resource.plans })),
      
      staffingNeeds: {
        currentStaff: college.totalStaffCount,
        recommendedRatio: Math.ceil(college.totalStudents / 20), // 1:20 ratio recommendation
        gap: Math.max(0, Math.ceil(college.totalStudents / 20) - college.totalStaffCount)
      }
    };

    return res.json({
      college: {
        id: college._id,
        name: college.collegeName,
        type: college.campusType,
        location: `${college.district}, ${college.province}`
      },
      kpis,
      enrollmentTrends,
      resourceGaps,
      projectStatus: {
        ongoing: college.ongoingProjects?.length || 0,
        immediate: college.immediateConstruction?.length || 0,
        future: college.futureConstruction?.length || 0
      }
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch college performance', error: err.message });
  }
});

// Get college budget requirements analysis
router.get('/api/colleges/:id/budget-analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const college = await College.findById(id);
    if (!college) return res.status(404).json({ message: 'College not found' });

    // Priority-based budget estimation
    const budgetRequirements = {
      // Critical Infrastructure (High Priority)
      criticalInfrastructure: {
        priority: 'High',
        items: Object.entries(college.buildings)
          .filter(([_, building]) => building.condition === 'Poor')
          .map(([type, building]) => ({
            type,
            buildings: building.buildings,
            estimatedCost: building.buildings * 2000000 // 20 lakh per building renovation
          })),
        totalEstimated: Object.values(college.buildings)
          .filter(building => building.condition === 'Poor')
          .reduce((sum, building) => sum + (building.buildings * 2000000), 0)
      },

      // Technology Upgrades (Medium Priority)
      technologyUpgrades: {
        priority: 'Medium',
        items: Object.entries({
          ...college.classroomTech,
          ...college.libraryResources,
          ...college.labEquipment
        }).filter(([_, resource]) => !resource.available && resource.plans)
          .map(([type, resource]) => ({
            type,
            plans: resource.plans,
            estimatedCost: type.includes('lab') ? 1500000 : 500000
          })),
        totalEstimated: Object.entries({
          ...college.classroomTech,
          ...college.libraryResources,
          ...college.labEquipment
        }).filter(([_, resource]) => !resource.available && resource.plans)
          .reduce((sum, [type, _]) => sum + (type.includes('lab') ? 1500000 : 500000), 0)
      },

      // Capacity Expansion (Low Priority)
      capacityExpansion: {
        priority: 'Low',
        newConstructions: college.immediateConstruction?.map(item => ({
          item,
          estimatedCost: 5000000 // 50 lakh per new construction
        })) || [],
        totalEstimated: (college.immediateConstruction?.length || 0) * 5000000
      },

      // Ongoing Projects Budget
      ongoingProjects: {
        totalBudget: college.ongoingProjects?.reduce((sum, project) => sum + (project.budget || 0), 0) || 0,
        projectCount: college.ongoingProjects?.length || 0
      }
    };

    const totalBudgetNeed = budgetRequirements.criticalInfrastructure.totalEstimated +
                           budgetRequirements.technologyUpgrades.totalEstimated +
                           budgetRequirements.capacityExpansion.totalEstimated;

    // ROI Analysis based on student capacity and infrastructure score
    const roiAnalysis = {
      currentStudentCapacity: college.totalStudents,
      potentialCapacityAfterUpgrade: college.totalStudents * 1.3, // 30% increase estimate
      investmentPerStudent: totalBudgetNeed > 0 ? Math.round(totalBudgetNeed / college.totalStudents) : 0,
      infrastructureEfficiencyGain: Math.max(0, 85 - college.calculateInfrastructureScore()), // Target 85% efficiency
      priorityScore: calculatePriorityScore(college, budgetRequirements)
    };

    return res.json({
      college: {
        id: college._id,
        name: college.collegeName,
        type: college.campusType
      },
      budgetRequirements,
      totalBudgetNeed,
      roiAnalysis,
      recommendations: generateBudgetRecommendations(college, budgetRequirements, roiAnalysis)
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to analyze budget requirements', error: err.message });
  }
});

// ===== SYSTEM-WIDE ANALYTICS =====

// Get comprehensive system-wide performance overview
router.get('/api/colleges/system/overview', async (req, res) => {
  try {
    const { province, district, campusType } = req.query;
    
    // Build filter
    const filter = { isActive: true, status: 'Approved' };
    if (province) filter.province = province;
    if (district) filter.district = district;
    if (campusType) filter.campusType = campusType;

    const colleges = await College.find(filter);

    // System-wide KPIs
    const systemKPIs = {
      totalColleges: colleges.length,
      totalStudents: colleges.reduce((sum, c) => sum + (c.totalStudents || 0), 0),
      totalStaff: colleges.reduce((sum, c) => sum + (c.totalStaffCount || 0), 0),
      averageStudentTeacherRatio: calculateSystemAverage(colleges, c => 
        c.totalStudents && c.totalStaffCount > 0 ? c.totalStudents / c.totalStaffCount : 0),
      
      // Infrastructure metrics
      averageInfrastructureScore: calculateSystemAverage(colleges, c => c.calculateInfrastructureScore()),
      totalLandArea: colleges.reduce((sum, c) => sum + (c.landAreaSquareMeter || 0), 0),
      averageLandUtilization: calculateSystemAverage(colleges, c => 
        c.landAreaSquareMeter > 0 ? (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 : 0),

      // Gender distribution
      genderDistribution: {
        male: colleges.reduce((sum, c) => sum + (c.maleStudents || 0), 0),
        female: colleges.reduce((sum, c) => sum + (c.femaleStudents || 0), 0),
        other: colleges.reduce((sum, c) => sum + (c.otherStudents || 0), 0)
      },

      // Technology readiness
      systemTechReadiness: calculateSystemAverage(colleges, calculateCollegeTechReadiness)
    };

    // Performance distribution
    const performanceDistribution = {
      excellent: colleges.filter(c => c.calculateInfrastructureScore() >= 80).length,
      good: colleges.filter(c => c.calculateInfrastructureScore() >= 60 && c.calculateInfrastructureScore() < 80).length,
      average: colleges.filter(c => c.calculateInfrastructureScore() >= 40 && c.calculateInfrastructureScore() < 60).length,
      poor: colleges.filter(c => c.calculateInfrastructureScore() < 40).length
    };

    // Regional comparison
    const regionalComparison = await College.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$province',
          collegeCount: { $sum: 1 },
          totalStudents: { $sum: '$totalStudents' },
          avgInfraScore: { $avg: { $multiply: [{ $size: { $filter: { input: { $objectToArray: '$buildings' }, cond: { $eq: ['$$this.v.condition', 'Good'] } } } }, 100] } },
          totalLandArea: { $sum: '$landAreaSquareMeter' }
        }
      },
      { $sort: { collegeCount: -1 } }
    ]);

    return res.json({
      systemKPIs,
      performanceDistribution,
      regionalComparison,
      filters: { province, district, campusType },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch system overview', error: err.message });
  }
});

// Get budget allocation recommendations for all colleges
router.get('/api/colleges/budget/allocation-recommendations', async (req, res) => {
  try {
    const { totalBudget, priority = 'all' } = req.query;
    const budget = parseInt(totalBudget) || 0;

    const colleges = await College.find({ isActive: true, status: 'Approved' });

    // Calculate priority scores for all colleges
    const collegeAnalysis = colleges.map(college => {
      const infrastructureScore = college.calculateInfrastructureScore();
      const studentImpact = college.totalStudents || 0;
      const completionRate = college.completionPercentage || 0;
      
      // Critical infrastructure needs
      const criticalInfraCount = Object.values(college.buildings)
        .filter(building => building.condition === 'Poor').length;
      
      // Technology gaps
      const techGaps = Object.values({
        ...college.classroomTech,
        ...college.libraryResources,
        ...college.labEquipment
      }).filter(resource => !resource.available).length;

      // Priority scoring (0-100)
      const priorityScore = Math.round(
        (100 - infrastructureScore) * 0.3 +  // Infrastructure need (30%)
        (studentImpact / 1000) * 0.25 +      // Student impact (25%)
        (criticalInfraCount * 10) * 0.2 +    // Critical needs (20%)
        (techGaps * 5) * 0.15 +              // Technology gaps (15%)
        (100 - completionRate) * 0.1         // Completion urgency (10%)
      );

      const estimatedNeed = 
        criticalInfraCount * 2000000 +       // Critical infrastructure
        techGaps * 750000 +                  // Technology upgrades
        (college.immediateConstruction?.length || 0) * 5000000; // New constructions

      return {
        college: {
          id: college._id,
          name: college.collegeName,
          type: college.campusType,
          location: `${college.district}, ${college.province}`,
          students: college.totalStudents
        },
        metrics: {
          infrastructureScore,
          priorityScore,
          studentImpact,
          criticalInfraCount,
          techGaps,
          completionRate
        },
        budgetAnalysis: {
          estimatedNeed,
          costPerStudent: studentImpact > 0 ? Math.round(estimatedNeed / studentImpact) : 0,
          roi: studentImpact > 0 ? Math.round((studentImpact * 0.3) / (estimatedNeed / 1000000)) : 0
        }
      };
    });

    // Sort by priority score
    const sortedColleges = collegeAnalysis.sort((a, b) => b.metrics.priorityScore - a.metrics.priorityScore);

    // Budget allocation algorithm
    let remainingBudget = budget;
    const allocations = [];
    const totalEstimatedNeed = sortedColleges.reduce((sum, c) => sum + c.budgetAnalysis.estimatedNeed, 0);

    sortedColleges.forEach((college, index) => {
      if (remainingBudget <= 0) {
        allocations.push({
          ...college,
          allocation: {
            amount: 0,
            percentage: 0,
            priority: 'Unfunded',
            coverageRatio: 0
          }
        });
        return;
      }

      // Allocation based on priority and available budget
      let allocation;
      if (budget > 0) {
        // Proportional allocation with priority weighting
        const baseAllocation = (college.budgetAnalysis.estimatedNeed / totalEstimatedNeed) * budget;
        const priorityMultiplier = college.metrics.priorityScore / 100;
        allocation = Math.min(
          Math.round(baseAllocation * priorityMultiplier * 1.2), // 20% priority boost
          college.budgetAnalysis.estimatedNeed,
          remainingBudget
        );
      } else {
        allocation = 0;
      }

      remainingBudget -= allocation;

      const coverageRatio = college.budgetAnalysis.estimatedNeed > 0 
        ? Math.round((allocation / college.budgetAnalysis.estimatedNeed) * 100) : 100;

      let priorityLevel = 'Low';
      if (college.metrics.priorityScore >= 75) priorityLevel = 'Critical';
      else if (college.metrics.priorityScore >= 50) priorityLevel = 'High';
      else if (college.metrics.priorityScore >= 25) priorityLevel = 'Medium';

      allocations.push({
        ...college,
        allocation: {
          amount: allocation,
          percentage: budget > 0 ? Math.round((allocation / budget) * 100 * 100) / 100 : 0,
          priority: priorityLevel,
          coverageRatio
        }
      });
    });

    // Summary statistics
    const allocationSummary = {
      totalBudget: budget,
      totalAllocated: budget - remainingBudget,
      remainingBudget,
      utilizationRate: budget > 0 ? Math.round(((budget - remainingBudget) / budget) * 100) : 0,
      collegesFullyFunded: allocations.filter(a => a.allocation.coverageRatio >= 95).length,
      collegesPartiallyFunded: allocations.filter(a => a.allocation.coverageRatio > 0 && a.allocation.coverageRatio < 95).length,
      collegesUnfunded: allocations.filter(a => a.allocation.coverageRatio === 0).length,
      averageAllocation: allocations.length > 0 ? Math.round((budget - remainingBudget) / allocations.length) : 0,
      totalEstimatedNeed,
      fundingGap: totalEstimatedNeed - (budget - remainingBudget)
    };

    // Filter by priority if specified
    let filteredAllocations = allocations;
    if (priority !== 'all') {
      filteredAllocations = allocations.filter(a => 
        a.allocation.priority.toLowerCase() === priority.toLowerCase()
      );
    }

    return res.json({
      allocations: filteredAllocations,
      summary: allocationSummary,
      methodology: {
        scoringFactors: [
          { factor: 'Infrastructure Need', weight: '30%' },
          { factor: 'Student Impact', weight: '25%' },
          { factor: 'Critical Infrastructure', weight: '20%' },
          { factor: 'Technology Gaps', weight: '15%' },
          { factor: 'Completion Urgency', weight: '10%' }
        ]
      },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate budget allocation recommendations', error: err.message });
  }
});

// Get resource utilization and efficiency metrics
router.get('/api/colleges/system/resource-efficiency', async (req, res) => {
  try {
    const { province, campusType } = req.query;
    
    const filter = { isActive: true, status: 'Approved' };
    if (province) filter.province = province;
    if (campusType) filter.campusType = campusType;

    const colleges = await College.find(filter);

    // Resource efficiency analysis
    const resourceEfficiency = {
      // Land utilization efficiency
      landUtilization: {
        highlyEfficient: colleges.filter(c => 
          c.landAreaSquareMeter > 0 && (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 >= 40
        ).length,
        moderatelyEfficient: colleges.filter(c => 
          c.landAreaSquareMeter > 0 && 
          (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 >= 20 && 
          (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 < 40
        ).length,
        underutilized: colleges.filter(c => 
          c.landAreaSquareMeter > 0 && (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 < 20
        ).length,
        averageUtilization: calculateSystemAverage(colleges, c => 
          c.landAreaSquareMeter > 0 ? (c.areaBuildingInfra / c.landAreaSquareMeter) * 100 : 0
        )
      },

      // Infrastructure condition distribution
      infrastructureHealth: {
        excellent: colleges.filter(c => c.calculateInfrastructureScore() >= 85).length,
        good: colleges.filter(c => c.calculateInfrastructureScore() >= 70 && c.calculateInfrastructureScore() < 85).length,
        fair: colleges.filter(c => c.calculateInfrastructureScore() >= 50 && c.calculateInfrastructureScore() < 70).length,
        poor: colleges.filter(c => c.calculateInfrastructureScore() < 50).length,
        systemAverage: calculateSystemAverage(colleges, c => c.calculateInfrastructureScore())
      },

      // Student-infrastructure ratio
      capacityEfficiency: colleges.map(college => {
        const totalCapacity = Object.values(college.buildings)
          .reduce((sum, building) => sum + (building.capacity || 0), 0);
        return {
          college: college.collegeName,
          students: college.totalStudents,
          capacity: totalCapacity,
          utilization: totalCapacity > 0 ? Math.round((college.totalStudents / totalCapacity) * 100) : 0,
          efficiency: totalCapacity > 0 ? 
            (college.totalStudents / totalCapacity >= 0.7 && college.totalStudents / totalCapacity <= 0.9) ? 'Optimal' :
            college.totalStudents / totalCapacity > 0.9 ? 'Overcrowded' : 'Underutilized'
            : 'No Data'
        };
      }).filter(c => c.capacity > 0)
    };

    // Technology adoption rates
    const technologyAdoption = {
      classroomTech: calculateAdoptionRate(colleges, 'classroomTech'),
      libraryResources: calculateAdoptionRate(colleges, 'libraryResources'),
      labEquipment: calculateAdoptionRate(colleges, 'labEquipment'),
      onlineLearning: calculateAdoptionRate(colleges, 'onlineLearning')
    };

    // Efficiency benchmarks and recommendations
    const benchmarks = {
      studentTeacherRatio: {
        target: 20,
        current: calculateSystemAverage(colleges, c => 
          c.totalStudents && c.totalStaffCount > 0 ? c.totalStudents / c.totalStaffCount : 0),
        status: function() {
          const current = this.current;
          return current <= 15 ? 'Over-staffed' : 
                 current <= 25 ? 'Optimal' : 'Under-staffed';
        }()
      },
      landUtilization: {
        target: 30, // 30% land utilization target
        current: resourceEfficiency.landUtilization.averageUtilization,
        status: function() {
          const current = this.current;
          return current >= 25 ? 'Efficient' : 'Can be improved';
        }()
      },
      infrastructureHealth: {
        target: 75, // 75% infrastructure health target
        current: resourceEfficiency.infrastructureHealth.systemAverage,
        status: function() {
          const current = this.current;
          return current >= 70 ? 'Good' : current >= 50 ? 'Needs attention' : 'Critical';
        }()
      }
    };

    return res.json({
      resourceEfficiency,
      technologyAdoption,
      benchmarks,
      recommendations: generateEfficiencyRecommendations(resourceEfficiency, benchmarks),
      totalCollegesAnalyzed: colleges.length,
      filters: { province, campusType },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to analyze resource efficiency', error: err.message });
  }
});

// Get enrollment trends and projections
router.get('/api/colleges/system/enrollment-trends', async (req, res) => {
  try {
    const { province, timeframe = '5' } = req.query;
    const years = parseInt(timeframe);
    
    const filter = { isActive: true, status: 'Approved' };
    if (province) filter.province = province;

    const colleges = await College.find(filter);

    // Aggregate enrollment data across all colleges
    const systemEnrollmentTrends = {};
    const availableYears = [2077, 2078, 2079, 2080, 2081];
    
    availableYears.forEach(year => {
      const yearData = colleges.reduce((acc, college) => {
        const enrollData = college.enrollmentData?.[year];
        if (enrollData) {
          acc.masterEnrollment += enrollData.masterEnrollment || 0;
          acc.bachelorEnrollment += enrollData.bachelorEnrollment || 0;
          acc.totalEnrollment += (enrollData.masterEnrollment || 0) + (enrollData.bachelorEnrollment || 0);
          acc.masterAppeared += enrollData.masterAppeared || 0;
          acc.bachelorAppeared += enrollData.bachelorAppeared || 0;
          acc.masterPassed += enrollData.masterPassed || 0;
          acc.bachelorPassed += enrollData.bachelorPassed || 0;
        }
        return acc;
      }, {
        masterEnrollment: 0,
        bachelorEnrollment: 0,
        totalEnrollment: 0,
        masterAppeared: 0,
        bachelorAppeared: 0,
        masterPassed: 0,
        bachelorPassed: 0
      });

      // Calculate pass rates
      const totalAppeared = yearData.masterAppeared + yearData.bachelorAppeared;
      const totalPassed = yearData.masterPassed + yearData.bachelorPassed;
      
      systemEnrollmentTrends[year] = {
        ...yearData,
        passRate: totalAppeared > 0 ? Math.round((totalPassed / totalAppeared) * 100 * 100) / 100 : 0,
        masterPassRate: yearData.masterAppeared > 0 ? 
          Math.round((yearData.masterPassed / yearData.masterAppeared) * 100 * 100) / 100 : 0,
        bachelorPassRate: yearData.bachelorAppeared > 0 ? 
          Math.round((yearData.bachelorPassed / yearData.bachelorAppeared) * 100 * 100) / 100 : 0
      };
    });

    // Calculate growth rates
    const enrollmentGrowth = [];
    for (let i = 1; i < availableYears.length; i++) {
      const currentYear = availableYears[i];
      const previousYear = availableYears[i - 1];
      
      const current = systemEnrollmentTrends[currentYear];
      const previous = systemEnrollmentTrends[previousYear];
      
      if (current && previous && previous.totalEnrollment > 0) {
        const growthRate = ((current.totalEnrollment - previous.totalEnrollment) / previous.totalEnrollment) * 100;
        enrollmentGrowth.push({
          year: currentYear,
          growthRate: Math.round(growthRate * 100) / 100,
          absoluteGrowth: current.totalEnrollment - previous.totalEnrollment
        });
      }
    });

    // Enrollment projections for next 3 years
    const avgGrowthRate = enrollmentGrowth.length > 0 
      ? enrollmentGrowth.reduce((sum, g) => sum + g.growthRate, 0) / enrollmentGrowth.length
      : 5; // Default 5% growth

    const currentEnrollment = systemEnrollmentTrends[2081]?.totalEnrollment || 0;
    const projections = [];
    for (let i = 1; i <= 3; i++) {
      const projectedYear = 2081 + i;
      const projectedEnrollment = Math.round(currentEnrollment * Math.pow(1 + (avgGrowthRate / 100), i));
      projections.push({
        year: projectedYear,
        projectedEnrollment,
        growthAssumption: Math.round(avgGrowthRate * 100) / 100
      });
    }

    // Performance analysis
    const performanceAnalysis = {
      averagePassRate: Object.values(systemEnrollmentTrends).reduce((sum, year) => sum + year.passRate, 0) / availableYears.length,
      passRateTrend: (() => {
        const rates = Object.values(systemEnrollmentTrends).map(y => y.passRate).filter(r => r > 0);
        if (rates.length < 2) return 'Insufficient data';
        const firstHalf = rates.slice(0, Math.ceil(rates.length / 2));
        const secondHalf = rates.slice(Math.ceil(rates.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        return secondAvg > firstAvg ? 'Improving' : secondAvg < firstAvg ? 'Declining' : 'Stable';
      })(),
      masterVsBachelorTrend: {
        masterShare: Object.values(systemEnrollmentTrends).map(y => 
          y.totalEnrollment > 0 ? (y.masterEnrollment / y.totalEnrollment) * 100 : 0
        ),
        bachelorShare: Object.values(systemEnrollmentTrends).map(y => 
          y.totalEnrollment > 0 ? (y.bachelorEnrollment / y.totalEnrollment) * 100 : 0
        )
      }
    };

    // Regional comparison if province not specified
    let regionalComparison = null;
    if (!province) {
      regionalComparison = await College.aggregate([
        { $match: { isActive: true, status: 'Approved' } },
        { $unwind: { path: '$enrollmentData', includeArrayIndex: 'year' } },
        {
          $group: {
            _id: '$province',
            totalCurrentEnrollment: { $sum: '$totalStudents' },
            avgPassRate: { 
              $avg: {
                $cond: [
                  { $gt: [{ $add: ['$enrollmentData.masterAppeared', '$enrollmentData.bachelorAppeared'] }, 0] },
                  {
                    $multiply: [
                      { $divide: [
                        { $add: ['$enrollmentData.masterPassed', '$enrollmentData.bachelorPassed'] },
                        { $add: ['$enrollmentData.masterAppeared', '$enrollmentData.bachelorAppeared'] }
                      ]},
                      100
                    ]
                  },
                  0
                ]
              }
            },
            collegeCount: { $sum: 1 }
          }
        },
        { $sort: { totalCurrentEnrollment: -1 } }
      ]);
    }

    return res.json({
      systemEnrollmentTrends: Object.entries(systemEnrollmentTrends).map(([year, data]) => ({
        year: parseInt(year),
        ...data
      })).sort((a, b) => a.year - b.year),
      enrollmentGrowth,
      projections,
      performanceAnalysis,
      regionalComparison,
      summary: {
        totalCurrentEnrollment: currentEnrollment,
        avgAnnualGrowth: Math.round(avgGrowthRate * 100) / 100,
        totalCollegesAnalyzed: colleges.length,
        dataYearsAvailable: availableYears.length
      },
      filters: { province, timeframe: years },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to analyze enrollment trends', error: err.message });
  }
});

// Get infrastructure and facility gaps analysis
router.get('/api/colleges/system/infrastructure-gaps', async (req, res) => {
  try {
    const { priority = 'all', province, campusType } = req.query;
    
    const filter = { isActive: true, status: 'Approved' };
    if (province) filter.province = province;
    if (campusType) filter.campusType = campusType;

    const colleges = await College.find(filter);

    // Critical infrastructure gaps
    const infrastructureGaps = {
      criticalConditionBuildings: colleges.map(college => {
        const criticalBuildings = Object.entries(college.buildings)
          .filter(([_, building]) => building.condition === 'Poor' || building.condition === 'Needs Repairing')
          .map(([type, building]) => ({
            type,
            condition: building.condition,
            count: building.buildings,
            capacity: building.capacity
          }));

        return {
          college: {
            id: college._id,
            name: college.collegeName,
            location: `${college.district}, ${college.province}`,
            students: college.totalStudents
          },
          criticalBuildings,
          totalCriticalBuildings: criticalBuildings.reduce((sum, b) => sum + b.count, 0),
          affectedCapacity: criticalBuildings.reduce((sum, b) => sum + (b.capacity || 0), 0)
        };
      }).filter(c => c.totalCriticalBuildings > 0),

      // Technology gaps analysis
      technologyGaps: colleges.map(college => {
        const allTechResources = {
          ...college.classroomTech,
          ...college.libraryResources,
          ...college.labEquipment,
          ...college.onlineLearning
        };

        const gaps = Object.entries(allTechResources)
          .filter(([_, resource]) => !resource.available)
          .map(([type, resource]) => ({
            type,
            plans: resource.plans,
            category: getResourceCategory(type)
          }));

        return {
          college: {
            id: college._id,
            name: college.collegeName,
            students: college.totalStudents
          },
          gaps,
          gapCount: gaps.length,
          hasPlans: gaps.filter(g => g.plans && g.plans.trim()).length
        };
      }).filter(c => c.gapCount > 0),

      // Capacity vs enrollment analysis
      capacityGaps: colleges.map(college => {
        const totalCapacity = Object.values(college.buildings)
          .reduce((sum, building) => sum + (building.capacity || 0), 0);
        
        const utilizationRate = totalCapacity > 0 ? (college.totalStudents / totalCapacity) : 0;
        
        let status = 'No Data';
        if (totalCapacity > 0) {
          if (utilizationRate > 1.1) status = 'Overcrowded';
          else if (utilizationRate > 0.85) status = 'Near Capacity';
          else if (utilizationRate > 0.5) status = 'Optimal';
          else status = 'Underutilized';
        }

        return {
          college: {
            id: college._id,
            name: college.collegeName,
            location: `${college.district}, ${college.province}`
          },
          currentStudents: college.totalStudents,
          totalCapacity,
          utilizationRate: Math.round(utilizationRate * 100),
          status,
          capacityGap: utilizationRate > 1 ? college.totalStudents - totalCapacity : 0
        };
      }).filter(c => c.totalCapacity > 0)
    };

    // Priority-based gap analysis
    const priorityAnalysis = {
      high: {
        criticalInfrastructure: infrastructureGaps.criticalConditionBuildings.filter(c => 
          c.totalCriticalBuildings >= 3 || c.affectedCapacity >= 200
        ),
        overcrowdedColleges: infrastructureGaps.capacityGaps.filter(c => c.status === 'Overcrowded'),
        majorTechGaps: infrastructureGaps.technologyGaps.filter(c => c.gapCount >= 5)
      },
      medium: {
        moderateInfrastructure: infrastructureGaps.criticalConditionBuildings.filter(c => 
          c.totalCriticalBuildings >= 1 && c.totalCriticalBuildings < 3
        ),
        nearCapacityColleges: infrastructureGaps.capacityGaps.filter(c => c.status === 'Near Capacity'),
        moderateTechGaps: infrastructureGaps.technologyGaps.filter(c => c.gapCount >= 2 && c.gapCount < 5)
      },
      low: {
        minorInfrastructure: infrastructureGaps.criticalConditionBuildings.filter(c => 
          c.totalCriticalBuildings < 1
        ),
        underutilized: infrastructureGaps.capacityGaps.filter(c => c.status === 'Underutilized'),
        minorTechGaps: infrastructureGaps.technologyGaps.filter(c => c.gapCount < 2)
      }
    };

    // Cost estimation for addressing gaps
    const costEstimation = {
      infrastructure: {
        highPriority: priorityAnalysis.high.criticalInfrastructure.reduce((sum, c) => 
          sum + (c.totalCriticalBuildings * 2500000), 0), // 25 lakh per critical building
        mediumPriority: priorityAnalysis.medium.moderateInfrastructure.reduce((sum, c) => 
          sum + (c.totalCriticalBuildings * 2000000), 0), // 20 lakh per building
        total: function() { return this.highPriority + this.mediumPriority; }()
      },
      technology: {
        highPriority: priorityAnalysis.high.majorTechGaps.reduce((sum, c) => 
          sum + (c.gapCount * 800000), 0), // 8 lakh per major tech gap
        mediumPriority: priorityAnalysis.medium.moderateTechGaps.reduce((sum, c) => 
          sum + (c.gapCount * 600000), 0), // 6 lakh per moderate tech gap
        total: function() { return this.highPriority + this.mediumPriority; }()
      },
      capacityExpansion: {
        highPriority: priorityAnalysis.high.overcrowdedColleges.reduce((sum, c) => 
          sum + (c.capacityGap * 50000), 0), // 50k per additional student capacity
        total: function() { return this.highPriority; }()
      }
    };

    const totalEstimatedCost = costEstimation.infrastructure.total + 
                              costEstimation.technology.total + 
                              costEstimation.capacityExpansion.total;

    // Filter results based on priority if specified
    let filteredResults = infrastructureGaps;
    if (priority !== 'all') {
      filteredResults = {
        criticalConditionBuildings: priorityAnalysis[priority]?.criticalInfrastructure || [],
        technologyGaps: priorityAnalysis[priority]?.majorTechGaps || priorityAnalysis[priority]?.moderateTechGaps || [],
        capacityGaps: priorityAnalysis[priority]?.overcrowdedColleges || priorityAnalysis[priority]?.nearCapacityColleges || []
      };
    }

    return res.json({
      gaps: filteredResults,
      priorityAnalysis: {
        high: {
          count: priorityAnalysis.high.criticalInfrastructure.length + 
                 priorityAnalysis.high.overcrowdedColleges.length + 
                 priorityAnalysis.high.majorTechGaps.length,
          estimatedCost: costEstimation.infrastructure.highPriority + 
                        costEstimation.technology.highPriority + 
                        costEstimation.capacityExpansion.highPriority
        },
        medium: {
          count: priorityAnalysis.medium.moderateInfrastructure.length + 
                 priorityAnalysis.medium.nearCapacityColleges.length + 
                 priorityAnalysis.medium.moderateTechGaps.length,
          estimatedCost: costEstimation.infrastructure.mediumPriority + 
                        costEstimation.technology.mediumPriority
        },
        low: {
          count: priorityAnalysis.low.minorInfrastructure.length + 
                 priorityAnalysis.low.underutilized.length + 
                 priorityAnalysis.low.minorTechGaps.length,
          estimatedCost: 0 // Low priority items typically don't require immediate funding
        }
      },
      costEstimation,
      totalEstimatedCost,
      summary: {
        totalCollegesWithGaps: new Set([
          ...infrastructureGaps.criticalConditionBuildings.map(c => c.college.id),
          ...infrastructureGaps.technologyGaps.map(c => c.college.id),
          ...infrastructureGaps.capacityGaps.filter(c => c.status === 'Overcrowded').map(c => c.college.id)
        ]).size,
        totalCollegesAnalyzed: colleges.length,
        gapPercentage: Math.round((new Set([
          ...infrastructureGaps.criticalConditionBuildings.map(c => c.college.id),
          ...infrastructureGaps.technologyGaps.map(c => c.college.id),
          ...infrastructureGaps.capacityGaps.filter(c => c.status === 'Overcrowded').map(c => c.college.id)
        ]).size / colleges.length) * 100)
      },
      filters: { priority, province, campusType },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to analyze infrastructure gaps', error: err.message });
  }
});

// Get comparative analysis between colleges
router.get('/api/colleges/system/comparative-analysis', async (req, res) => {
  try {
    const { metric = 'performance', province, campusType, limit = 20 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 50);
    
    const filter = { isActive: true, status: 'Approved' };
    if (province) filter.province = province;
    if (campusType) filter.campusType = campusType;

    const colleges = await College.find(filter);

    let comparativeData = [];

    switch (metric) {
      case 'performance':
        comparativeData = colleges.map(college => ({
          college: {
            id: college._id,
            name: college.collegeName,
            type: college.campusType,
            location: `${college.district}, ${college.province}`
          },
          metrics: {
            infrastructureScore: college.calculateInfrastructureScore(),
            studentTeacherRatio: college.totalStaffCount > 0 ? 
              Math.round((college.totalStudents / college.totalStaffCount) * 100) / 100 : 0,
            completionRate: college.completionPercentage,
            techReadiness: calculateCollegeTechReadiness(college),
            landUtilization: college.landAreaSquareMeter > 0 ? 
              Math.round((college.areaBuildingInfra / college.landAreaSquareMeter) * 100 * 100) / 100 : 0
          },
          overallScore: calculateOverallPerformanceScore(college)
        })).sort((a, b) => b.overallScore - a.overallScore);
        break;

      case 'efficiency':
        comparativeData = colleges.map(college => {
          const totalCapacity = Object.values(college.buildings)
            .reduce((sum, building) => sum + (building.capacity || 0), 0);
          
          return {
            college: {
              id: college._id,
              name: college.collegeName,
              type: college.campusType,
              location: `${college.district}, ${college.province}`
            },
            metrics: {
              capacityUtilization: totalCapacity > 0 ? 
                Math.round((college.totalStudents / totalCapacity) * 100 * 100) / 100 : 0,
              landEfficiency: college.landAreaSquareMeter > 0 ? 
                Math.round((college.totalStudents / college.landAreaSquareMeter) * 10000) / 100 : 0, // students per hectare
              staffEfficiency: college.totalStaffCount > 0 ? 
                Math.round((college.totalStudents / college.totalStaffCount) * 100) / 100 : 0,
              costPerStudent: college.totalStudents > 0 && college.ongoingProjects?.length > 0 ? 
                Math.round((college.ongoingProjects.reduce((sum, p) => sum + (p.budget || 0), 0) / college.totalStudents)) : 0
            },
            efficiencyScore: calculateEfficiencyScore(college)
          };
        }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);
        break;

      case 'growth':
        comparativeData = colleges.map(college => {
          const enrollmentData = Object.entries(college.enrollmentData || {})
            .map(([year, data]) => ({
              year: parseInt(year),
              total: (data.masterEnrollment || 0) + (data.bachelorEnrollment || 0)
            }))
            .sort((a, b) => a.year - b.year);

          let growthRate = 0;
          if (enrollmentData.length >= 2) {
            const firstYear = enrollmentData[0];
            const lastYear = enrollmentData[enrollmentData.length - 1];
            const years = lastYear.year - firstYear.year;
            if (years > 0 && firstYear.total > 0) {
              growthRate = Math.round((Math.pow(lastYear.total / firstYear.total, 1/years) - 1) * 100 * 100) / 100;
            }
          }

          return {
            college: {
              id: college._id,
              name: college.collegeName,
              type: college.campusType,
              location: `${college.district}, ${college.province}`
            },
            metrics: {
              currentEnrollment: college.totalStudents,
              growthRate,
              projectCount: college.ongoingProjects?.length || 0,
              futureConstruction: college.futureConstruction?.length || 0,
              infrastructureGrowth: college.immediateConstruction?.length || 0
            },
            growthScore: calculateGrowthScore(college, growthRate)
          };
        }).sort((a, b) => b.growthScore - a.growthScore);
        break;

      case 'needs':
        comparativeData = colleges.map(college => {
          const criticalBuildings = Object.values(college.buildings)
            .filter(building => building.condition === 'Poor').length;
          
          const techGaps = Object.values({
            ...college.classroomTech,
            ...college.libraryResources,
            ...college.labEquipment
          }).filter(resource => !resource.available).length;

          return {
            college: {
              id: college._id,
              name: college.collegeName,
              type: college.campusType,
              location: `${college.district}, ${college.province}`,
              students: college.totalStudents
            },
            needs: {
              criticalInfrastructure: criticalBuildings,
              technologyGaps: techGaps,
              capacityShortfall: Math.max(0, college.totalStudents - Object.values(college.buildings)
                .reduce((sum, building) => sum + (building.capacity || 0), 0)),
              completionNeeds: 100 - college.completionPercentage
            },
            urgencyScore: calculateUrgencyScore(college, criticalBuildings, techGaps)
          };
        }).sort((a, b) => b.urgencyScore - a.urgencyScore);
        break;

      default:
        return res.status(400).json({ 
          message: 'Invalid metric. Choose from: performance, efficiency, growth, needs' 
        });
    }

    // Add rankings
    comparativeData.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Calculate percentiles and statistical measures
    const values = comparativeData.map(item => {
      switch (metric) {
        case 'performance': return item.overallScore;
        case 'efficiency': return item.efficiencyScore;
        case 'growth': return item.growthScore;
        case 'needs': return item.urgencyScore;
        default: return 0;
      }
    });

    const statistics = {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
      min: Math.min(...values),
      max: Math.max(...values),
      standardDeviation: Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - 
        (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length)
    };

    // Group analysis
    const groupAnalysis = {
      byProvince: {},
      byCampusType: {},
      byPerformanceTier: {
        excellent: comparativeData.filter((_, i) => i < comparativeData.length * 0.2).length,
        good: comparativeData.filter((_, i) => i >= comparativeData.length * 0.2 && i < comparativeData.length * 0.5).length,
        average: comparativeData.filter((_, i) => i >= comparativeData.length * 0.5 && i < comparativeData.length * 0.8).length,
        needsImprovement: comparativeData.filter((_, i) => i >= comparativeData.length * 0.8).length
      }
    };

    // Group by province
    comparativeData.forEach(item => {
      const province = item.college.location.split(', ')[1];
      if (!groupAnalysis.byProvince[province]) {
        groupAnalysis.byProvince[province] = { count: 0, avgRank: 0 };
      }
      groupAnalysis.byProvince[province].count++;
      groupAnalysis.byProvince[province].avgRank += item.rank;
    });

    Object.keys(groupAnalysis.byProvince).forEach(province => {
      groupAnalysis.byProvince[province].avgRank = 
        Math.round(groupAnalysis.byProvince[province].avgRank / groupAnalysis.byProvince[province].count);
    });

    // Group by campus type
    comparativeData.forEach(item => {
      const type = item.college.type;
      if (!groupAnalysis.byCampusType[type]) {
        groupAnalysis.byCampusType[type] = { count: 0, avgRank: 0 };
      }
      groupAnalysis.byCampusType[type].count++;
      groupAnalysis.byCampusType[type].avgRank += item.rank;
    });

    Object.keys(groupAnalysis.byCampusType).forEach(type => {
      groupAnalysis.byCampusType[type].avgRank = 
        Math.round(groupAnalysis.byCampusType[type].avgRank / groupAnalysis.byCampusType[type].count);
    });

    return res.json({
      comparative: comparativeData.slice(0, maxLimit),
      statistics: Object.keys(statistics).reduce((acc, key) => {
        acc[key] = Math.round(statistics[key] * 100) / 100;
        return acc;
      }, {}),
      groupAnalysis,
      insights: generateComparativeInsights(comparativeData, metric, groupAnalysis),
      metadata: {
        metric,
        totalColleges: colleges.length,
        displayedColleges: Math.min(maxLimit, colleges.length),
        filters: { province, campusType, limit: maxLimit }
      },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to generate comparative analysis', error: err.message });
  }
});

// ===== HELPER FUNCTIONS =====

function calculateSystemAverage(colleges, valueExtractor) {
  const values = colleges.map(valueExtractor).filter(v => v > 0);
  return values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : 0;
}

function calculateCollegeTechReadiness(college) {
  const allTech = {
    ...college.classroomTech,
    ...college.libraryResources,
    ...college.labEquipment,
    ...college.onlineLearning
  };
  const available = Object.values(allTech).filter(resource => resource.available).length;
  const total = Object.keys(allTech).length;
  return total > 0 ? Math.round((available / total) * 100) : 0;
}

function calculateAdoptionRate(colleges, category) {
  const categoryData = colleges.map(college => {
    const resources = college[category] || {};
    const available = Object.values(resources).filter(resource => resource.available).length;
    const total = Object.keys(resources).length;
    return total > 0 ? (available / total) * 100 : 0;
  });
  
  return {
    average: calculateSystemAverage(colleges, () => categoryData.reduce((a, b) => a + b, 0) / categoryData.length),
    distribution: {
      high: colleges.filter((_, i) => categoryData[i] >= 75).length,
      medium: colleges.filter((_, i) => categoryData[i] >= 50 && categoryData[i] < 75).length,
      low: colleges.filter((_, i) => categoryData[i] < 50).length
    }
  };
}

function getResourceCategory(resourceType) {
  if (['projectors', 'smartBoards', 'microphones'].includes(resourceType)) return 'Classroom Technology';
  if (['physicalBooks', 'eLibrary', 'databases'].includes(resourceType)) return 'Library Resources';
  if (['scienceLab', 'engineeringLab', 'agricultureLab'].includes(resourceType)) return 'Laboratory Equipment';
  if (['lms', 'onlineCourses', 'remoteLearning'].includes(resourceType)) return 'Online Learning';
  return 'Other';
}

function calculatePriorityScore(college, budgetRequirements) {
  const infrastructureScore = college.calculateInfrastructureScore();
  const studentImpact = college.totalStudents || 0;
  const criticalInfraCount = budgetRequirements.criticalInfrastructure.items.length;
  const techGapsCount = budgetRequirements.technologyUpgrades.items.length;
  
  return Math.round(
    (100 - infrastructureScore) * 0.3 +
    Math.min(studentImpact / 10, 100) * 0.25 +
    Math.min(criticalInfraCount * 20, 100) * 0.2 +
    Math.min(techGapsCount * 10, 100) * 0.15 +
    (100 - college.completionPercentage) * 0.1
  );
}

function generateBudgetRecommendations(college, budgetRequirements, roiAnalysis) {
  const recommendations = [];
  
  if (budgetRequirements.criticalInfrastructure.totalEstimated > 0) {
    recommendations.push({
      type: 'Critical Infrastructure',
      priority: 'High',
      description: `Address ${budgetRequirements.criticalInfrastructure.items.length} critical infrastructure needs`,
      estimatedCost: budgetRequirements.criticalInfrastructure.totalEstimated,
      expectedImpact: 'Immediate safety and functionality improvements'
    });
  }
  
  if (roiAnalysis.priorityScore >= 70) {
    recommendations.push({
      type: 'Priority Funding',
      priority: 'High',
      description: 'High-impact college requiring immediate attention',
      justification: `Priority score: ${roiAnalysis.priorityScore}/100`
    });
  }
  
  if (budgetRequirements.technologyUpgrades.totalEstimated > 0) {
    recommendations.push({
      type: 'Technology Enhancement',
      priority: 'Medium',
      description: 'Upgrade technology infrastructure for better learning outcomes',
      estimatedCost: budgetRequirements.technologyUpgrades.totalEstimated
    });
  }
  
  return recommendations;
}

function generateEfficiencyRecommendations(resourceEfficiency, benchmarks) {
  const recommendations = [];
  
  if (resourceEfficiency.landUtilization.averageUtilization < 20) {
    recommendations.push({
      category: 'Land Utilization',
      recommendation: 'Develop comprehensive land utilization plans for underutilized colleges',
      priority: 'Medium',
      impact: 'Increased infrastructure capacity without additional land acquisition'
    });
  }
  
  if (resourceEfficiency.infrastructureHealth.systemAverage < 60) {
    recommendations.push({
      category: 'Infrastructure Health',
      recommendation: 'Implement systematic infrastructure maintenance program',
      priority: 'High',
      impact: 'Prevent infrastructure deterioration and reduce long-term costs'
    });
  }
  
  if (benchmarks.studentTeacherRatio.current > 25) {
    recommendations.push({
      category: 'Staff Optimization',
      recommendation: 'Recruit additional faculty to meet student-teacher ratio targets',
      priority: 'High',
      impact: 'Improved educational quality and student outcomes'
    });
  }
  
  return recommendations;
}

function calculateOverallPerformanceScore(college) {
  const infraScore = college.calculateInfrastructureScore();
  const techScore = calculateCollegeTechReadiness(college);
  const completionScore = college.completionPercentage;
  const utilizationScore = college.landAreaSquareMeter > 0 ? 
    Math.min((college.areaBuildingInfra / college.landAreaSquareMeter) * 100 * 2.5, 100) : 50;
  
  return Math.round((infraScore * 0.3 + techScore * 0.25 + completionScore * 0.25 + utilizationScore * 0.2) * 100) / 100;
}

function calculateEfficiencyScore(college) {
  const totalCapacity = Object.values(college.buildings).reduce((sum, building) => sum + (building.capacity || 0), 0);
  const capacityScore = totalCapacity > 0 ? Math.min((college.totalStudents / totalCapacity) * 100, 100) : 0;
  const landScore = college.landAreaSquareMeter > 0 ? Math.min((college.areaBuildingInfra / college.landAreaSquareMeter) * 100 * 2, 100) : 0;
  const staffScore = college.totalStaffCount > 0 ? Math.min((college.totalStudents / college.totalStaffCount) * 4, 100) : 0;
  
  return Math.round((capacityScore * 0.4 + landScore * 0.3 + staffScore * 0.3) * 100) / 100;
}

function calculateGrowthScore(college, growthRate) {
  const projectScore = Math.min((college.ongoingProjects?.length || 0) * 20, 100);
  const constructionScore = Math.min(((college.immediateConstruction?.length || 0) + (college.futureConstruction?.length || 0)) * 15, 100);
  const enrollmentGrowthScore = Math.max(0, Math.min(growthRate * 10, 100));
  
  return Math.round((projectScore * 0.4 + constructionScore * 0.3 + enrollmentGrowthScore * 0.3) * 100) / 100;
}

function calculateUrgencyScore(college, criticalBuildings, techGaps) {
  const infraUrgency = Math.min(criticalBuildings * 25, 100);
  const techUrgency = Math.min(techGaps * 8, 100);
  const capacityUrgency = (() => {
    const totalCapacity = Object.values(college.buildings).reduce((sum, building) => sum + (building.capacity || 0), 0);
    if (totalCapacity === 0) return 50;
    const utilizationRate = college.totalStudents / totalCapacity;
    return utilizationRate > 1.1 ? 100 : utilizationRate > 0.9 ? 60 : 0;
  })();
  const completionUrgency = 100 - college.completionPercentage;
  
  return Math.round((infraUrgency * 0.35 + techUrgency * 0.25 + capacityUrgency * 0.25 + completionUrgency * 0.15) * 100) / 100;
}

function generateComparativeInsights(data, metric, groupAnalysis) {
  const insights = [];
  
  // Top performers insight
  const topPerformer = data[0];
  if (topPerformer) {
    insights.push({
      type: 'Top Performer',
      description: `${topPerformer.college.name} leads in ${metric} with excellent results`,
      college: topPerformer.college.name,
      location: topPerformer.college.location
    });
  }
  
  // Regional performance insight
  const provincePerformance = Object.entries(groupAnalysis.byProvince)
    .sort((a, b) => a[1].avgRank - b[1].avgRank);
  
  if (provincePerformance.length > 0) {
    insights.push({
      type: 'Regional Excellence',
      description: `${provincePerformance[0][0]} shows the best average performance in ${metric}`,
      avgRank: provincePerformance[0][1].avgRank,
      collegeCount: provincePerformance[0][1].count
    });
  }
  
  // Campus type insight
  const campusTypePerformance = Object.entries(groupAnalysis.byCampusType)
    .sort((a, b) => a[1].avgRank - b[1].avgRank);
    
  if (campusTypePerformance.length > 0) {
    insights.push({
      type: 'Campus Type Analysis',
      description: `${campusTypePerformance[0][0]} colleges show better average ${metric} performance`,
      avgRank: campusTypePerformance[0][1].avgRank
    });
  }
  
  // Performance distribution insight
  const distribution = groupAnalysis.byPerformanceTier;
  insights.push({
    type: 'Performance Distribution',
    description: `${distribution.excellent} colleges performing excellently, ${distribution.needsImprovement} need improvement`,
    distribution
  });
  
  return insights;
}

// ===== BUDGET MONITORING & TRACKING ROUTES =====

// Get budget utilization tracking
router.get('/api/colleges/budget/utilization-tracking', async (req, res) => {
  try {
    const { year, province, projectStatus } = req.query;
    
    const filter = { isActive: true };
    if (province) filter.province = province;

    const colleges = await College.find(filter);
    
    // Aggregate budget data from ongoing projects
    const budgetUtilization = colleges.map(college => {
      const projects = college.ongoingProjects || [];
      let filteredProjects = projects;
      
      if (projectStatus) {
        filteredProjects = projects.filter(p => p.status === projectStatus);
      }
      
      if (year) {
        filteredProjects = projects.filter(p => 
          p.startDate && new Date(p.startDate).getFullYear().toString() === year
        );
      }
      
      const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
      const completedProjects = filteredProjects.filter(p => p.status === 'Completed');
      const completedBudget = completedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
      const inProgressBudget = filteredProjects
        .filter(p => p.status === 'In Progress')
        .reduce((sum, p) => sum + (p.budget || 0), 0);
      const plannedBudget = filteredProjects
        .filter(p => p.status === 'Planning')
        .reduce((sum, p) => sum + (p.budget || 0), 0);
      
      return {
        college: {
          id: college._id,
          name: college.collegeName,
          type: college.campusType,
          location: `${college.district}, ${college.province}`
        },
        budgetSummary: {
          totalAllocated: totalBudget,
          completed: completedBudget,
          inProgress: inProgressBudget,
          planned: plannedBudget,
          utilizationRate: totalBudget > 0 ? Math.round((completedBudget / totalBudget) * 100) : 0
        },
        projects: {
          total: filteredProjects.length,
          completed: completedProjects.length,
          inProgress: filteredProjects.filter(p => p.status === 'In Progress').length,
          planning: filteredProjects.filter(p => p.status === 'Planning').length,
          onHold: filteredProjects.filter(p => p.status === 'On Hold').length
        },
        timeline: {
          overdue: filteredProjects.filter(p => 
            p.expectedEndDate && new Date(p.expectedEndDate) < new Date() && p.status !== 'Completed'
          ).length,
          onTrack: filteredProjects.filter(p => 
            p.expectedEndDate && new Date(p.expectedEndDate) >= new Date() && p.status === 'In Progress'
          ).length
        }
      };
    }).filter(c => c.budgetSummary.totalAllocated > 0);

    // System-wide budget analytics
    const systemSummary = {
      totalSystemBudget: budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.totalAllocated, 0),
      totalUtilized: budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.completed, 0),
      totalInProgress: budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.inProgress, 0),
      totalPlanned: budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.planned, 0),
      systemUtilizationRate: (() => {
        const total = budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.totalAllocated, 0);
        const utilized = budgetUtilization.reduce((sum, c) => sum + c.budgetSummary.completed, 0);
        return total > 0 ? Math.round((utilized / total) * 100) : 0;
      })(),
      totalProjects: budgetUtilization.reduce((sum, c) => sum + c.projects.total, 0),
      completedProjects: budgetUtilization.reduce((sum, c) => sum + c.projects.completed, 0),
      overdueProjects: budgetUtilization.reduce((sum, c) => sum + c.timeline.overdue, 0)
    };

    // Performance indicators
    const performanceIndicators = {
      budgetEfficiency: {
        high: budgetUtilization.filter(c => c.budgetSummary.utilizationRate >= 80).length,
        medium: budgetUtilization.filter(c => 
          c.budgetSummary.utilizationRate >= 50 && c.budgetSummary.utilizationRate < 80
        ).length,
        low: budgetUtilization.filter(c => c.budgetSummary.utilizationRate < 50).length
      },
      projectCompletion: {
        excellent: budgetUtilization.filter(c => 
          c.projects.total > 0 && (c.projects.completed / c.projects.total) >= 0.8
        ).length,
        good: budgetUtilization.filter(c => 
          c.projects.total > 0 && 
          (c.projects.completed / c.projects.total) >= 0.5 && 
          (c.projects.completed / c.projects.total) < 0.8
        ).length,
        poor: budgetUtilization.filter(c => 
          c.projects.total > 0 && (c.projects.completed / c.projects.total) < 0.5
        ).length
      },
      timelineAdherence: {
        onTrack: budgetUtilization.reduce((sum, c) => sum + c.timeline.onTrack, 0),
        delayed: budgetUtilization.reduce((sum, c) => sum + c.timeline.overdue, 0),
        adherenceRate: (() => {
          const total = budgetUtilization.reduce((sum, c) => sum + c.timeline.onTrack + c.timeline.overdue, 0);
          const onTrack = budgetUtilization.reduce((sum, c) => sum + c.timeline.onTrack, 0);
          return total > 0 ? Math.round((onTrack / total) * 100) : 0;
        })()
      }
    };

    // Monthly/Quarterly trends if year specified
    let trends = null;
    if (year) {
      trends = await generateBudgetTrends(colleges, year);
    }

    return res.json({
      collegeUtilization: budgetUtilization.sort((a, b) => b.budgetSummary.utilizationRate - a.budgetSummary.utilizationRate),
      systemSummary,
      performanceIndicators,
      trends,
      alerts: generateBudgetAlerts(budgetUtilization, systemSummary),
      filters: { year, province, projectStatus },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to track budget utilization', error: err.message });
  }
});

// Get project monitoring dashboard
router.get('/api/colleges/projects/monitoring', async (req, res) => {
  try {
    const { status, priority, province, overdue } = req.query;
    
    const filter = { isActive: true };
    if (province) filter.province = province;

    const colleges = await College.find(filter);
    
    // Collect all projects with college context
    const allProjects = [];
    colleges.forEach(college => {
      if (college.ongoingProjects && college.ongoingProjects.length > 0) {
        college.ongoingProjects.forEach(project => {
          let include = true;
          
          // Apply filters
          if (status && project.status !== status) include = false;
          if (priority && project.priority !== priority) include = false;
          if (overdue === 'true' && (!project.expectedEndDate || new Date(project.expectedEndDate) >= new Date())) include = false;
          if (overdue === 'false' && project.expectedEndDate && new Date(project.expectedEndDate) < new Date()) include = false;
          
          if (include) {
            // Calculate project health metrics
            const isOverdue = project.expectedEndDate && new Date(project.expectedEndDate) < new Date() && project.status !== 'Completed';
            const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(project.expectedEndDate)) / (1000 * 60 * 60 * 24)) : 0;
            const duration = project.startDate && project.expectedEndDate ? 
              Math.ceil((new Date(project.expectedEndDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24)) : 0;
            
            allProjects.push({
              project: {
                id: project._id,
                title: project.title,
                description: project.description,
                budget: project.budget,
                status: project.status,
                priority: project.priority,
                startDate: project.startDate,
                expectedEndDate: project.expectedEndDate
              },
              college: {
                id: college._id,
                name: college.collegeName,
                location: `${college.district}, ${college.province}`
              },
              health: {
                isOverdue,
                daysOverdue,
                duration,
                healthScore: calculateProjectHealthScore(project, isOverdue, daysOverdue)
              }
            });
          }
        });
      }
    });

    // Project analytics
    const projectAnalytics = {
      totalProjects: allProjects.length,
      byStatus: {
        Planning: allProjects.filter(p => p.project.status === 'Planning').length,
        'In Progress': allProjects.filter(p => p.project.status === 'In Progress').length,
        Completed: allProjects.filter(p => p.project.status === 'Completed').length,
        'On Hold': allProjects.filter(p => p.project.status === 'On Hold').length
      },
      byPriority: {
        High: allProjects.filter(p => p.project.priority === 'High').length,
        Medium: allProjects.filter(p => p.project.priority === 'Medium').length,
        Low: allProjects.filter(p => p.project.priority === 'Low').length
      },
      budget: {
        total: allProjects.reduce((sum, p) => sum + (p.project.budget || 0), 0),
        byStatus: {
          Planning: allProjects.filter(p => p.project.status === 'Planning')
            .reduce((sum, p) => sum + (p.project.budget || 0), 0),
          'In Progress': allProjects.filter(p => p.project.status === 'In Progress')
            .reduce((sum, p) => sum + (p.project.budget || 0), 0),
          Completed: allProjects.filter(p => p.project.status === 'Completed')
            .reduce((sum, p) => sum + (p.project.budget || 0), 0),
          'On Hold': allProjects.filter(p => p.project.status === 'On Hold')
            .reduce((sum, p) => sum + (p.project.budget || 0), 0)
        }
      },
      timeline: {
        overdue: allProjects.filter(p => p.health.isOverdue).length,
        onTrack: allProjects.filter(p => !p.health.isOverdue && p.project.status !== 'Completed').length,
        avgDaysOverdue: (() => {
          const overdueProjects = allProjects.filter(p => p.health.isOverdue);
          return overdueProjects.length > 0 ? 
            Math.round(overdueProjects.reduce((sum, p) => sum + p.health.daysOverdue, 0) / overdueProjects.length) : 0;
        })()
      }
    };

    // Risk assessment
    const riskAssessment = {
      highRisk: allProjects.filter(p => p.health.healthScore < 40),
      mediumRisk: allProjects.filter(p => p.health.healthScore >= 40 && p.health.healthScore < 70),
      lowRisk: allProjects.filter(p => p.health.healthScore >= 70),
      criticalProjects: allProjects
        .filter(p => p.project.priority === 'High' && (p.health.isOverdue || p.project.status === 'On Hold'))
        .map(p => ({
          project: p.project.title,
          college: p.college.name,
          issue: p.health.isOverdue ? `${p.health.daysOverdue} days overdue` : 'On hold',
          budget: p.project.budget
        }))
    };

    // Performance metrics
    const performanceMetrics = {
      completionRate: allProjects.length > 0 ? 
        Math.round((projectAnalytics.byStatus.Completed / allProjects.length) * 100) : 0,
      budgetUtilization: projectAnalytics.budget.total > 0 ? 
        Math.round((projectAnalytics.budget.byStatus.Completed / projectAnalytics.budget.total) * 100) : 0,
      timelineAdherence: allProjects.filter(p => p.project.status !== 'Planning').length > 0 ? 
        Math.round((projectAnalytics.timeline.onTrack / 
        (projectAnalytics.timeline.onTrack + projectAnalytics.timeline.overdue)) * 100) : 0,
      averageProjectHealth: allProjects.length > 0 ? 
        Math.round(allProjects.reduce((sum, p) => sum + p.health.healthScore, 0) / allProjects.length) : 0
    };

    // Sort projects by health score (worst first) and priority
    const sortedProjects = allProjects.sort((a, b) => {
      if (a.health.healthScore !== b.health.healthScore) {
        return a.health.healthScore - b.health.healthScore;
      }
      const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      return priorityOrder[b.project.priority] - priorityOrder[a.project.priority];
    });

    return res.json({
      projects: sortedProjects,
      analytics: projectAnalytics,
      riskAssessment,
      performanceMetrics,
      recommendations: generateProjectRecommendations(riskAssessment, performanceMetrics),
      filters: { status, priority, province, overdue },
      generatedAt: new Date()
    });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to monitor projects', error: err.message });
  }
});

// Helper functions for budget monitoring
async function generateBudgetTrends(colleges, year) {
  // This would ideally use historical project data
  // For now, we'll simulate trends based on project start dates
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  return months.map(month => {
    const monthlyProjects = colleges.flatMap(college => 
      (college.ongoingProjects || []).filter(project => 
        project.startDate && 
        new Date(project.startDate).getFullYear().toString() === year &&
        new Date(project.startDate).getMonth() + 1 === month
      )
    );
    
    return {
      month,
      projectsStarted: monthlyProjects.length,
      budgetAllocated: monthlyProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
      avgProjectBudget: monthlyProjects.length > 0 ? 
        Math.round(monthlyProjects.reduce((sum, p) => sum + (p.budget || 0), 0) / monthlyProjects.length) : 0
    };
  });
}

function generateBudgetAlerts(budgetUtilization, systemSummary) {
  const alerts = [];
  
  // Low utilization alert
  const lowUtilization = budgetUtilization.filter(c => c.budgetSummary.utilizationRate < 30);
  if (lowUtilization.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'Budget Utilization',
      message: `${lowUtilization.length} colleges have budget utilization below 30%`,
      action: 'Review project timelines and implementation strategies',
      affectedColleges: lowUtilization.slice(0, 5).map(c => c.college.name)
    });
  }
  
  // High overdue projects
  const highOverdue = budgetUtilization.filter(c => c.timeline.overdue >= 3);
  if (highOverdue.length > 0) {
    alerts.push({
      type: 'danger',
      category: 'Project Delays',
      message: `${highOverdue.length} colleges have 3+ overdue projects`,
      action: 'Immediate intervention required for project management',
      affectedColleges: highOverdue.slice(0, 5).map(c => c.college.name)
    });
  }
  
  // System utilization alert
  if (systemSummary.systemUtilizationRate < 50) {
    alerts.push({
      type: 'warning',
      category: 'System Performance',
      message: `Overall system budget utilization is ${systemSummary.systemUtilizationRate}%`,
      action: 'Review system-wide project implementation processes'
    });
  }
  
  return alerts;
}

function calculateProjectHealthScore(project, isOverdue, daysOverdue) {
  let score = 100;
  
  // Deduct for project status
  if (project.status === 'On Hold') score -= 40;
  else if (project.status === 'Planning') score -= 10;
  
  // Deduct for being overdue
  if (isOverdue) {
    score -= Math.min(daysOverdue * 2, 50); // Max 50 points deduction for delays
  }
  
  // Adjust for priority
  if (project.priority === 'High' && isOverdue) score -= 20;
  if (project.priority === 'Low' && !isOverdue) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

function generateProjectRecommendations(riskAssessment, performanceMetrics) {
  const recommendations = [];
  
  if (riskAssessment.highRisk.length > 0) {
    recommendations.push({
      priority: 'High',
      category: 'Risk Management',
      action: `Review ${riskAssessment.highRisk.length} high-risk projects immediately`,
      description: 'High-risk projects require immediate attention to prevent failure',
      expectedImpact: 'Prevent project failures and budget losses'
    });
  }
  
  if (performanceMetrics.completionRate < 60) {
    recommendations.push({
      priority: 'High',
      category: 'Project Management',
      action: 'Implement enhanced project management processes',
      description: `Current completion rate of ${performanceMetrics.completionRate}% is below target`,
      expectedImpact: 'Improve project delivery and budget utilization'
    });
  }
  
  if (riskAssessment.criticalProjects.length > 0) {
    recommendations.push({
      priority: 'Critical',
      category: 'Critical Projects',
      action: 'Emergency intervention for critical projects',
      description: `${riskAssessment.criticalProjects.length} high-priority projects are at risk`,
      expectedImpact: 'Prevent critical infrastructure delays'
    });
  }
  
  if (performanceMetrics.timelineAdherence < 70) {
    recommendations.push({
      priority: 'Medium',
      category: 'Timeline Management',
      action: 'Strengthen project timeline monitoring',
      description: `Timeline adherence at ${performanceMetrics.timelineAdherence}% needs improvement`,
      expectedImpact: 'Reduce project delays and cost overruns'
    });
  }
  
  return recommendations;
}

// Export helper functions if needed
module.exports.calculateSystemAverage = calculateSystemAverage;
module.exports.calculateCollegeTechReadiness = calculateCollegeTechReadiness; 




