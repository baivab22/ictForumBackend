/**
 * Multer Configuration for Cloudinary Uploads
 * -------------------------------------------
 * Handles two main upload types:
 *  - Posts (single image)
 *  - Members (multiple documents & images)
 */

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary.config');

// ============================================================
// 🖼️ CLOUDINARY STORAGE FOR POSTS
// ============================================================

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ictforum/posts', // Cloudinary folder for post images
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1200, crop: 'limit' }], // optional resize
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const name = file.originalname.split('.')[0].replace(/\s+/g, '_');
      return `post-${name}-${uniqueSuffix}`;
    },
  },
});

// Multer instance for post uploads
const postUploader = multer({
  storage: postStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// ============================================================
// 👥 CLOUDINARY STORAGE FOR MEMBER DOCUMENTS
// ============================================================

const memberStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Determine Cloudinary subfolder based on field name
    let folder = 'ictforum/members/others';
    switch (file.fieldname) {
      case 'citizenshipCopy':
        folder = 'ictforum/members/citizenship';
        break;
      case 'photo':
        folder = 'ictforum/members/photos';
        break;
      case 'recommendationLetter':
        folder = 'ictforum/members/recommendations';
        break;
      case 'resume':
        folder = 'ictforum/members/resumes';
        break;
    }

    // Create a clean and unique filename
    const name = file.originalname.split('.')[0].replace(/\s+/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

    return {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
      public_id: `member-${name}-${uniqueSuffix}`,
    };
  },
});

// Multer instance for member uploads
const memberUploader = multer({
  storage: memberStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// ============================================================
// 🚀 UPLOAD MIDDLEWARE EXPORTS
// ============================================================

// For single post image upload → req.file
const upload = postUploader.single('image');

// For multi-field member uploads → req.files
const memberUpload = memberUploader.fields([
  { name: 'citizenshipCopy', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'recommendationLetter', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
]);

// ============================================================
// 🧾 EXPORT CONFIGS
// ============================================================

module.exports = {
  upload,        // post upload middleware
  memberUpload,  // member multi-field upload
  postUploader,  // raw post multer instance (optional)
  memberUploader // raw member multer instance (optional)
};
