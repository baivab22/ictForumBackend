// config/multer.config.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Create uploads directory if it doesn't exist
 */
const createUploadDir = () => {
  const uploadDir = path.join(__dirname, '../uploads/posts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads/posts directory');
  }
};

/**
 * Configure storage for post images
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    createUploadDir();
    const uploadPath = path.join(__dirname, '../uploads/posts');
    console.log('Saving file to:', uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and random suffix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const filename = `post-${name}-${uniqueSuffix}${ext}`;
    
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

/**
 * File filter - only allow image files
 */
const fileFilter = (req, file, cb) => {
  console.log('File filter check:', file.mimetype);
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed!'), false);
  }
};

/**
 * Configure multer with storage, limits, and file filter
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;