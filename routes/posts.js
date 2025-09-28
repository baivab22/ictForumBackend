const express = require('express');
const path = require('path');
const upload = require('../config/multer.config'); // Import the multer config
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
router.use('/images', express.static(path.join(__dirname, '../uploads')));

// Public routes
router.get('/stats', getStats);
router.get('/admin', getAdminPosts);
router.get('/:id', getPost);
router.get('/', getPosts);

// Post interaction routes
router.put('/:id/like', likePost);
router.post('/:id/comments', addComment);

// CRUD routes with multer for file uploads
router.post('/', upload.single('image'), createPost);
router.put('/:id', upload.single('image'), updatePost);
router.delete('/:id', deletePost);

module.exports = router;