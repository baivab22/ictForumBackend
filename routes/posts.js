const express = require('express');
const path = require('path');
const { upload } = require('../config/multer.config');
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

// ============================================
// VERIFY UPLOAD MIDDLEWARE
// ============================================
console.log('🔍 Posts Router - Checking upload middleware...');
console.log('upload type:', typeof upload);
console.log('upload.single available:', typeof upload.single);

if (!upload || typeof upload.single !== 'function') {
  console.error('❌ ERROR: upload middleware is not properly configured!');
  console.error('Make sure config/multer.config.js exports "upload" correctly');
  process.exit(1);
}

console.log('✅ Upload middleware loaded successfully');

// ============================================
// STATIC FILE SERVING
// ============================================
// Serve static files from uploads folder
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// PUBLIC ROUTES (No upload needed)
// ============================================
router.get('/stats', getStats);
router.get('/admin', getAdminPosts);
router.get('/:id', getPost);
router.get('/', getPosts);

// ============================================
// POST INTERACTION ROUTES (No upload needed)
// ============================================
router.put('/:id/like', likePost);
router.post('/:id/comments', addComment);

// ============================================
// CRUD ROUTES WITH FILE UPLOADS
// ============================================

/**
 * POST /api/posts
 * Create new post with image upload
 * Expects: multipart/form-data with 'image' field
 */
router.post('/', upload.single('image'), (req, res, next) => {
  console.log('📝 POST /posts - File upload attempt');
  console.log('File received:', req.file ? req.file.filename : 'No file');
  console.log('Body:', req.body);
  next();
}, createPost);

/**
 * PUT /api/posts/:id
 * Update existing post with optional new image
 * Expects: multipart/form-data with optional 'image' field
 */
router.put('/:id', upload.single('image'), (req, res, next) => {
  console.log(`✏️ PUT /posts/${req.params.id} - File upload attempt`);
  console.log('File received:', req.file ? req.file.filename : 'No file');
  console.log('Body:', req.body);
  next();
}, updatePost);

/**
 * DELETE /api/posts/:id
 * Delete post (no upload needed)
 */
router.delete('/:id', deletePost);

// ============================================
// ERROR HANDLING FOR MULTER
// ============================================
router.use((error, req, res, next) => {
  if (error instanceof require('multer').MulterError) {
    console.error('❌ Multer Error:', error.message);
    
    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        error: error.message
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field in upload. Use "image" as field name.',
        error: error.message
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: error.message
    });
  }
  
  // Handle other errors (like file filter errors)
  if (error) {
    console.error('❌ Upload Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
});

module.exports = router;