const express = require('express');
const { body } = require('express-validator');
const path = require('path');
// const upload = require('../config/multer.config'); // Import the multer config
const {
  getPosts,
  getAdminPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  likePost,
  addComment,
  getStats
} = require('../controllers/postController');

const router = express.Router();

// Serve static images from uploads folder
router.use('/images', express.static(path.join(__dirname, '../uploads/posts')));

// Validation rules for creating posts
const createPostValidation = [
  body('title_en')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('English title must be between 5 and 200 characters'),
  body('content_en')
    .trim()
    .isLength({ min: 50 })
    .withMessage('English content must be at least 50 characters'),
  body('category')
    .isIn(['technology', 'digitalTransformation', 'socialJustice', 'events', 'innovation', 'policy', 'education', 'startups'])
    .withMessage('Please select a valid category')
];

// Validation rules for updating posts
const updatePostValidation = [
  body('title_en')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('English title must be between 5 and 200 characters'),
  body('content_en')
    .optional()
    .trim()
    .isLength({ min: 50 })
    .withMessage('English content must be at least 50 characters'),
  body('category')
    .optional()
    .isIn(['technology', 'digitalTransformation', 'socialJustice', 'events', 'innovation', 'policy', 'education', 'startups'])
    .withMessage('Please select a valid category')
];

// Comment validation
const commentValidation = [
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters'),
  body('userName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('User name must be between 1 and 50 characters')
];

// Public routes
router.get('/stats', getStats);
router.get('/admin', getAdminPosts);
router.get('/:id', getPost);
router.get('/', getPosts);

// Post interaction routes
router.put('/:id/like', likePost);
router.post('/:id/comments', commentValidation, addComment);

// CRUD routes with multer for file uploads
router.post('/', createPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

module.exports = router;