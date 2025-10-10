// controllers/postController.js
'use strict';

const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary.config');
const fs = require('fs');
const path = require('path');

/**
 * Helper: Try to delete an image resource.
 * - Prefer using stored `imagePublicId` (Cloudinary public_id).
 * - If only a Cloudinary URL exists, attempt to extract public_id and delete.
 * - If a local path exists, delete from filesystem.
 */
async function deleteImageResource(post) {
  try {
    // 1) If we have explicit Cloudinary public id
    if (post.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(post.imagePublicId);
        console.log('🗑️ Deleted Cloudinary resource (imagePublicId):', post.imagePublicId);
        return;
      } catch (err) {
        console.warn('⚠️ Failed to delete Cloudinary resource by imagePublicId:', err.message);
        // continue to other attempts
      }
    }

    // 2) If post.image is a Cloudinary URL, try to extract public_id
    if (post.image && typeof post.image === 'string' && /res\.cloudinary\.com/.test(post.image)) {
      // Example URL: https://res.cloudinary.com/<cloud>/image/upload/v1234567890/folder/subfolder/public-id.ext
      const match = post.image.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
      if (match && match[1]) {
        const publicId = match[1];
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log('🗑️ Deleted Cloudinary resource (from URL):', publicId);
          return;
        } catch (err) {
          console.warn('⚠️ Failed to delete Cloudinary resource extracted from URL:', err.message);
        }
      }
    }

    // 3) If post.image is a local path (string), delete from disk
    if (post.image && typeof post.image === 'string') {
      // If it's a URL (http/https other than Cloudinary) skip deleting from disk
      if (/^https?:\/\//.test(post.image) && !/res\.cloudinary\.com/.test(post.image)) {
        console.log('ℹ️ Image is external URL (not Cloudinary/local) — skipping filesystem deletion:', post.image);
      } else {
        // compute local path
        let localPath = post.image;
        // If it's relative like "uploads/..." or "/uploads/..." convert to project path
        if (!path.isAbsolute(localPath)) {
          localPath = path.join(__dirname, '..', localPath);
        }
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
            console.log('🗑️ Deleted local image file:', localPath);
            return;
          } catch (err) {
            console.warn('⚠️ Failed to delete local image file:', err.message);
          }
        }
      }
    }

    // 4) If post.image is an object with a `.path` (legacy multer object), attempt to delete
    if (post.image && typeof post.image === 'object' && post.image.path) {
      const p = post.image.path;
      let localPath = p;
      if (!path.isAbsolute(localPath)) {
        localPath = path.join(__dirname, '..', localPath);
      }
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
          console.log('🗑️ Deleted legacy local image object file:', localPath);
          return;
        } catch (err) {
          console.warn('⚠️ Failed to delete legacy local image file:', err.message);
        }
      }
    }

    // Nothing to delete (or all deletion attempts failed)
    console.log('ℹ️ No deletable image resource found (or deletion failed).');
  } catch (err) {
    console.error('❌ deleteImageResource error:', err);
  }
}

/* ===========================================================
   GET ALL POSTS (PUBLIC)
   GET /api/posts
   =========================================================== */
exports.getPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      featured,
      search,
      sort = '-createdAt',
      language = 'en'
    } = req.query;

    console.log('getPosts query:', req.query);

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    // Base: only published posts for public endpoint
    const query = { published: true };

    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true' || featured === true;
    if (search) query.$text = { $search: search };

    const posts = await Post.find(query)
      .populate('author', 'name email avatar')
      .sort(sort)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const transformedPosts = posts.map((post) => ({
      id: post._id,
      title: post[`title_${language}`] || post.title_en || 'Untitled',
      content: post[`content_${language}`] || post.content_en || '',
      excerpt: post[`excerpt_${language}`] || post.excerpt_en || '',
      category: post.category,
      image: post.image || null,
      author: post.author || null,
      tags: post.tags || [],
      featured: post.featured || false,
      views: post.views || 0,
      likes: (post.likes && post.likes.length) || 0,
      comments: (post.comments && post.comments.length) || 0,
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    }));

    const total = await Post.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: transformedPosts.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: transformedPosts
    });
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching posts'
    });
  }
};

/* ===========================================================
   GET ALL POSTS (ADMIN - includes drafts)
   GET /api/posts/admin
   =========================================================== */
exports.getAdminPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      featured,
      search,
      sort = '-createdAt',
      language = 'en'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 12, 1);

    const query = {}; // admin can see drafts and published

    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true' || featured === true;
    if (search) query.$text = { $search: search };

    const posts = await Post.find(query)
      .populate('author', 'name email avatar')
      .sort(sort)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const transformedPosts = posts.map((post) => ({
      id: post._id,
      title_en: post.title_en,
      title_np: post.title_np,
      content_en: post.content_en,
      content_np: post.content_np,
      excerpt_en: post.excerpt_en,
      excerpt_np: post.excerpt_np,
      category: post.category,
      image: post.image || null,
      author: post.author || { name: 'System Admin', email: 'admin@system.com' },
      tags: post.tags || [],
      featured: post.featured || false,
      published: post.published || false,
      views: post.views || 0,
      likes: (post.likes && post.likes.length) || 0,
      comments: post.comments || [],
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    }));

    const total = await Post.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: transformedPosts.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: transformedPosts
    });
  } catch (error) {
    console.error('Get admin posts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching posts'
    });
  }
};

/* ===========================================================
   GET SINGLE POST
   GET /api/posts/:id
   =========================================================== */
exports.getPost = async (req, res) => {
  try {
    const { language = 'en' } = req.query;

    const post = await Post.findById(req.params.id)
      .populate('author', 'name email avatar bio')
      .populate('comments.user', 'name avatar');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increase view count (simple increment)
    post.views = (post.views || 0) + 1;
    await post.save();

    const transformedPost = {
      id: post._id,
      title: post[`title_${language}`] || post.title_en || 'Untitled',
      content: post[`content_${language}`] || post.content_en || '',
      excerpt: post[`excerpt_${language}`] || post.excerpt_en || '',
      category: post.category,
      image: post.image || null,
      author: post.author || null,
      tags: post.tags || [],
      featured: post.featured || false,
      views: post.views || 0,
      likes: (post.likes && post.likes.length) || 0,
      comments: post.comments || [],
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    };

    return res.status(200).json({
      success: true,
      data: transformedPost
    });
  } catch (error) {
    console.error('Get post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching post'
    });
  }
};

/* ===========================================================
   CREATE NEW POST
   POST /api/posts
   Expects multipart/form-data with 'image' field optional
   =========================================================== */
exports.createPost = async (req, res) => {
  console.log('Create post - body:', req.body);
  console.log('Create post - file:', req.file);

  try {
    const postData = { ...req.body };

    // Handle tags sent as comma-separated string
    if (typeof postData.tags === 'string' && postData.tags.trim().length) {
      postData.tags = postData.tags.split(',').map((t) => t.trim());
    }

    // If file uploaded via Cloudinary multer storage
    if (req.file && req.file.path) {
      postData.image = req.file.path; // secure URL
      // file.filename is usually the public_id in multer-storage-cloudinary
      postData.imagePublicId = req.file.filename || req.file.public_id || null;
      console.log('Saved Cloudinary image:', postData.image, postData.imagePublicId);
    }

    // Default author if not provided
    if (!postData.author) {
      let defaultUser = await User.findOne({ email: 'admin@system.com' });
      if (!defaultUser) {
        defaultUser = await User.create({
          name: 'System Admin',
          email: 'admin@system.com',
          password: 'defaultpassword',
          role: 'admin'
        });
      }
      postData.author = defaultUser._id;
    }

    const createdPost = await Post.create(postData);
    await createdPost.populate('author', 'name email avatar');

    console.log('✅ Post created:', createdPost._id);

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: createdPost
    });
  } catch (error) {
    console.error('Create post error:', error);

    // If upload succeeded (Cloudinary) but DB failed, delete the uploaded cloud image to avoid orphaned files
    if (req.file && (req.file.filename || req.file.public_id)) {
      const publicId = req.file.filename || req.file.public_id;
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Rolled back uploaded Cloudinary image:', publicId);
      } catch (err) {
        console.warn('⚠️ Failed to roll back Cloudinary upload:', err.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Server error while creating post',
      error: error.message
    });
  }
};

/* ===========================================================
   UPDATE POST
   PUT /api/posts/:id
   Expects multipart/form-data with optional 'image' field
   =========================================================== */
exports.updatePost = async (req, res) => {
  console.log(`Update post ${req.params.id} - body:`, req.body);
  console.log('Update post - file:', req.file);

  try {
    const existingPost = await Post.findById(req.params.id);
    if (!existingPost) {
      // If a file was uploaded but the post doesn't exist, remove uploaded resource to avoid orphan
      if (req.file && (req.file.filename || req.file.public_id)) {
        try {
          const uploadedPublicId = req.file.filename || req.file.public_id;
          await cloudinary.uploader.destroy(uploadedPublicId);
          console.log('🗑️ Deleted newly uploaded Cloudinary image because post not found:', uploadedPublicId);
        } catch (err) {
          console.warn('⚠️ Failed to delete new uploaded Cloudinary file after missing post:', err.message);
        }
      }
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const updateData = { ...req.body };

    // Handle tags string => array
    if (typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map((t) => t.trim());
    }

    // If a new image was uploaded, delete the old one (Cloudinary/local) and save new info
    if (req.file && req.file.path) {
      // Delete previous resource (if any)
      try {
        await deleteImageResource(existingPost);
      } catch (err) {
        console.warn('⚠️ Failed deleting previous image resource during update:', err.message);
      }

      // Save new Cloudinary URL & public id
      updateData.image = req.file.path;
      updateData.imagePublicId = req.file.filename || req.file.public_id || null;
      console.log('✅ New image saved to post (cloud):', updateData.image, updateData.imagePublicId);
    }

    // Update the post
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('author', 'name email avatar');

    console.log('✅ Post updated:', updatedPost._id);

    return res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: updatedPost
    });
  } catch (error) {
    console.error('Update post error:', error);

    // If new file uploaded but update failed, attempt to remove the newly uploaded file
    if (req.file && (req.file.filename || req.file.public_id)) {
      const publicId = req.file.filename || req.file.public_id;
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Rolled back newly uploaded Cloudinary file after update error:', publicId);
      } catch (err) {
        console.warn('⚠️ Failed to roll back Cloudinary upload after update error:', err.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Server error while updating post',
      error: error.message
    });
  }
};

/* ===========================================================
   DELETE POST
   DELETE /api/posts/:id
   =========================================================== */
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Delete associated image resource if present (cloud/local)
    try {
      await deleteImageResource(post);
    } catch (err) {
      console.warn('⚠️ Warning while deleting associated image resource:', err.message);
    }

    await post.deleteOne();

    console.log('✅ Post deleted:', req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting post'
    });
  }
};

/* ===========================================================
   LIKE / UNLIKE POST
   PUT /api/posts/:id/like
   =========================================================== */
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Basic behavior: no auth, use req.body.userId if provided; else 'anonymous-user'
    const userId = req.body.userId || 'anonymous-user';
    const likeIndex = (post.likes || []).indexOf(userId);

    if (likeIndex > -1) {
      // unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // like
      post.likes = post.likes || [];
      post.likes.push(userId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      likes: (post.likes && post.likes.length) || 0
    });
  } catch (error) {
    console.error('Like post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while liking post'
    });
  }
};

/* ===========================================================
   ADD COMMENT
   POST /api/posts/:id/comments
   =========================================================== */
exports.addComment = async (req, res) => {
  try {
    const { text, userName = 'Anonymous' } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    let commentUser = await User.findOne({ name: userName });

    if (!commentUser) {
      try {
        commentUser = await User.create({
          name: userName,
          email: `${userName.toLowerCase().replace(/\s+/g, '')}@temp.com`,
          password: 'temppassword'
        });
      } catch (err) {
        // If user creation fails for some reason, fallback to anonymous user reference
        console.warn('⚠️ Could not create user for comment; using anonymous reference:', err.message);
        commentUser = { _id: null, name: userName };
      }
    }

    const newComment = {
      user: commentUser._id || null,
      text: text ? text.trim() : '',
      userName
    };

    post.comments = post.comments || [];
    post.comments.unshift(newComment);
    await post.save();

    // populate the recent comment user if possible
    await post.populate('comments.user', 'name avatar');

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: post.comments[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding comment'
    });
  }
};

/* ===========================================================
   DASHBOARD STATS
   GET /api/posts/stats
   =========================================================== */
exports.getStats = async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const publishedPosts = await Post.countDocuments({ published: true });
    const draftPosts = await Post.countDocuments({ published: false });
    const featuredPosts = await Post.countDocuments({ featured: true });

    const viewsResult = await Post.aggregate([
      { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$views', 0] } } } }
    ]);
    const totalViews = (viewsResult && viewsResult[0] && viewsResult[0].totalViews) || 0;

    const totalUsers = await User.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        totalPosts,
        publishedPosts,
        draftPosts,
        featuredPosts,
        totalViews,
        totalUsers,
        monthlyPosts: Math.floor(totalPosts / 12),
        monthlyViews: Math.floor(totalViews / 12)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching stats'
    });
  }
};
