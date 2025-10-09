const express = require('express');
const router = express.Router();
const {
  createMember,
  getAllMembers,
  getMemberById,
  updateMemberStatus,
  updateMember,
  deleteMember,
  getMembershipStats
} = require('../controllers/memberController');
const { memberUpload } = require('../config/multer.config');

// @route   POST /api/members
// @desc    Create new member application
// @access  Public
router.post('/', memberUpload, createMember);

// @route   GET /api/members
// @desc    Get all members with filtering and pagination
// @access  Private
router.get('/', getAllMembers);

// @route   GET /api/members/stats
// @desc    Get membership statistics
// @access  Private
router.get('/stats', getMembershipStats);

// @route   GET /api/members/:id
// @desc    Get single member by ID
// @access  Private
router.get('/:id', getMemberById);

// @route   PUT /api/members/:id/status
// @desc    Update member status
// @access  Private
router.put('/:id/status', updateMemberStatus);

// @route   PUT /api/members/:id
// @desc    Update member information
// @access  Private
router.put('/:id', updateMember);

// @route   DELETE /api/members/:id
// @desc    Delete member
// @access  Private
router.delete('/:id', deleteMember);

module.exports = router;