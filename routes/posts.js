const express = require('express');
const path = require('path');
const multer = require('multer');
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
// 🔍 VERIFY UPLOAD MIDDLEWARE
// ============================================
console.log('🔍 Posts Router - Verifying upload middleware...');
if (!upload || typeof upload !== 'function') {
  console.error('❌ ERROR: upload middleware is not properly configured!');
  console.error('Make sure config/multer.config.js exports "upload" correctly');
  process.exit(1);
}
console.log('✅ Upload middleware loaded successfully');

// ============================================
// 🚫 REMOVE STATIC FILE SERVING
// ============================================
// ❌ We no longer serve from local `/uploads` folder because
// all images are now stored on Cloudinary.
// (Keep this commented for reference)
//
// router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// 🌍 PUBLIC ROUTES (No upload needed)
// ============================================
router.get('/stats', getStats);
router.get('/admin', getAdminPosts);
router.get('/:id', getPost);
router.get('/', getPosts);

// ============================================
// ❤️ POST INTERACTION ROUTES
// ============================================
router.put('/:id/like', likePost);
router.post('/:id/comments', addComment);

// ============================================
// 🧾 CRUD ROUTES WITH IMAGE UPLOADS
// ============================================

/**
 * POST /api/posts
 * Create a new post with Cloudinary image upload.
 * Expects: multipart/form-data with 'image' field.
 */
router.post(
  '/',
  upload, // already .single('image') inside config
  (req, res, next) => {
    console.log('📝 POST /posts - Cloudinary upload initiated...');
    console.log('File received:', req.file ? req.file.path : 'No file uploaded');
    console.log('Body:', req.body);
    next();
  },
  createPost
);

/**
 * PUT /api/posts/:id
 * Update an existing post (optional new image upload).
 */
router.put(
  '/:id',
  upload,
  (req, res, next) => {
    console.log(`✏️ PUT /posts/${req.params.id} - File upload attempt`);
    console.log('File received:', req.file ? req.file.path : 'No file uploaded');
    console.log('Body:', req.body);
    next();
  },
  updatePost
);

/**
 * DELETE /api/posts/:id
 * Delete a post (no file upload needed).
 */
router.delete('/:id', deletePost);

// ============================================
// ⚠️ MULTER & UPLOAD ERROR HANDLING
// ============================================
router.use((error, req, res, next) => {
  // Handle multer-specific errors
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer Error:', error.message);

    const errorMessages = {
      LIMIT_FILE_SIZE: 'File too large. Maximum size is 10MB.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field. Use "image" as the field name.'
    };

    return res.status(400).json({
      success: false,
      message: errorMessages[error.code] || 'Multer upload error',
      error: error.message
    });
  }

  // Handle general upload or Cloudinary errors
  if (error) {
    console.error('❌ Upload/Cloudinary Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next();
});

module.exports = router;
