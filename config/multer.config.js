// config/multer.config.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create uploads directory if it doesn't exist
 */
const createUploadDir = () => {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Created uploads directory');
  }
};

// ============================================
// POST IMAGES CONFIGURATION
// ============================================

/**
 * Storage configuration for post images
 */
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    createUploadDir();
    
    const subDir = 'posts';
    const fullPath = path.join(__dirname, '../uploads', subDir);
    
    // Create subdirectory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created directory: ${subDir}`);
    }
    
    console.log('📂 Saving file to:', fullPath);
    cb(null, fullPath);
  },
  
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const filename = `post-${name}-${uniqueSuffix}${ext}`;
    
    console.log('📸 Generated filename:', filename);
    cb(null, filename);
  },
});

/**
 * File filter for post images
 */
const postFileFilter = (req, file, cb) => {
  console.log('🔍 File filter check:', file.originalname, '|', file.mimetype);
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files (JPG, PNG, GIF, WebP) are allowed! You uploaded: ${file.mimetype}`), false);
  }
};

/**
 * Multer instance for post images
 */
const postUploader = multer({
  storage: postStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: postFileFilter,
});

// ============================================
// MEMBER DOCUMENTS CONFIGURATION
// ============================================

/**
 * Storage configuration for member documents
 */
const memberStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    createUploadDir();
    
    // Determine subdirectory based on field name
    let subDir = 'members';
    switch (file.fieldname) {
      case 'citizenshipCopy':
        subDir = 'members/citizenship';
        break;
      case 'photo':
        subDir = 'members/photos';
        break;
      case 'recommendationLetter':
        subDir = 'members/recommendations';
        break;
      case 'resume':
        subDir = 'members/resumes';
        break;
      default:
        subDir = 'members/others';
    }
    
    const fullPath = path.join(__dirname, '../uploads', subDir);
    
    // Create subdirectory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created directory: ${subDir}`);
    }
    
    cb(null, fullPath);
  },
  
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `member-${name}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter for member documents
 */
const memberFileFilter = (req, file, cb) => {
  console.log('🔍 Member file check:', file.originalname, '|', file.mimetype);
  
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error(`Only images and PDFs are allowed for member uploads! You uploaded: ${file.mimetype}`), false);
  }
};

/**
 * Multer instance for member documents
 */
const memberUploader = multer({
  storage: memberStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: memberFileFilter,
});

// ============================================
// UPLOAD MIDDLEWARE CONFIGURATIONS
// ============================================

/**
 * Member upload middleware
 * Handles multiple document fields simultaneously
 */
const memberUpload = memberUploader.fields([
  { name: 'citizenshipCopy', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'recommendationLetter', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
]);

/**
 * Post upload middleware
 * This is what you'll use in your routes: upload.single('image')
 */
const upload = postUploader;

// ============================================
// EXPORTS
// ============================================

console.log('📦 Exporting multer configurations...');
console.log('✅ upload (for posts):', typeof upload);
console.log('✅ memberUpload (for members):', typeof memberUpload);
console.log('✅ postUploader:', typeof postUploader);
console.log('✅ memberUploader:', typeof memberUploader);

module.exports = {
  upload,           // Primary export for post uploads
  memberUpload,     // For member multi-field uploads
  postUploader,     // Raw post uploader instance
  memberUploader,   // Raw member uploader instance
};