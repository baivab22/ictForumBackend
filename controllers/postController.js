const Post = require('../models/Post');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
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

    // Build query
    let query = { published: true };
    
    if (category) {
      query.category = category;
    }
    
    if (featured) {
      query.featured = featured === 'true';
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const posts = await Post.find(query)
      .populate('author', 'name email avatar')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Transform posts based on language
    const transformedPosts = posts.map(post => ({
      id: post._id,
      title: post[`title_${language}`] || post.title_en,
      content: post[`content_${language}`] || post.content_en,
      excerpt: post[`excerpt_${language}`] || post.excerpt_en,
      category: post.category,
      image: post.image,
      author: post.author,
      tags: post.tags,
      featured: post.featured,
      views: post.views,
      likes: post.likes?.length || 0,
      comments: post.comments?.length || 0,
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    }));

    // Get total count for pagination
    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transformedPosts.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: transformedPosts
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching posts'
    });
  }
};

// @desc    Get all posts for admin (including drafts)
// @route   GET /api/posts/admin
// @access  Public (no auth required)
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

    // Build query (include both published and draft posts)
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const posts = await Post.find(query)
      .populate('author', 'name email avatar')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Transform posts based on language
    const transformedPosts = posts.map(post => ({
      id: post._id,
      title_en: post.title_en,
      title_np: post.title_np,
      content_en: post.content_en,
      content_np: post.content_np,
      excerpt_en: post.excerpt_en,
      excerpt_np: post.excerpt_np,
      category: post.category,
      image: post.image,
      author: post.author || { name: 'System Admin', email: 'admin@system.com' },
      tags: post.tags,
      featured: post.featured,
      published: post.published,
      views: post.views,
      likes: post.likes?.length || 0,
      comments: post.comments || [],
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    }));

    // Get total count for pagination
    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transformedPosts.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: transformedPosts
    });
  } catch (error) {
    console.error('Get admin posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching posts'
    });
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
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

    // Increment views
    post.views += 1;
    await post.save();

    // Transform post based on language
    const transformedPost = {
      id: post._id,
      title: post[`title_${language}`] || post.title_en,
      content: post[`content_${language}`] || post.content_en,
      excerpt: post[`excerpt_${language}`] || post.excerpt_en,
      category: post.category,
      image: post.image,
      author: post.author,
      tags: post.tags,
      featured: post.featured,
      views: post.views,
      likes: post.likes?.length || 0,
      comments: post.comments,
      publishedAt: post.createdAt,
      updatedAt: post.updatedAt
    };

    res.status(200).json({
      success: true,
      data: transformedPost
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching post'
    });
  }
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Public (no auth required)
exports.createPost = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Create a default author if none provided
    if (!req.body.author) {
      // Try to find or create a default admin user
      let defaultUser = await User.findOne({ email: 'admin@system.com' });
      
      if (!defaultUser) {
        defaultUser = await User.create({
          name: 'System Admin',
          email: 'admin@system.com',
          password: 'defaultpassword',
          role: 'admin'
        });
      }
      
      req.body.author = defaultUser._id;
    }

    const post = await Post.create(req.body);
    
    await post.populate('author', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating post',
      error: error.message
    });
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Public (no auth required)
exports.updatePost = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    post = await Post.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('author', 'name email avatar');

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: post
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating post'
    });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Public (no auth required)
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting post'
    });
  }
};

// @desc    Like/Unlike post
// @route   PUT /api/posts/:id/like
// @access  Public
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Use a default user ID if no auth
    const userId = req.body.userId || 'anonymous-user';
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex > -1) {
      // Unlike the post
      post.likes.splice(likeIndex, 1);
    } else {
      // Like the post
      post.likes.push(userId);
    }

    await post.save();

    res.status(200).json({
      success: true,
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      likes: post.likes.length
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while liking post'
    });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Public
exports.addComment = async (req, res) => {
  try {
    const { text, userName = 'Anonymous' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create default user for comment if none exists
    let defaultUser = await User.findOne({ name: userName });
    
    if (!defaultUser) {
      defaultUser = await User.create({
        name: userName,
        email: `${userName.toLowerCase().replace(/\s+/g, '')}@temp.com`,
        password: 'temppassword'
      });
    }

    const newComment = {
      user: defaultUser._id,
      text: text.trim()
    };

    post.comments.unshift(newComment);
    await post.save();

    await post.populate('comments.user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: post.comments[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding comment'
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/posts/stats
// @access  Public
exports.getStats = async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const publishedPosts = await Post.countDocuments({ published: true });
    const draftPosts = await Post.countDocuments({ published: false });
    const featuredPosts = await Post.countDocuments({ featured: true });
    
    // Calculate total views
    const viewsResult = await Post.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const totalViews = viewsResult.length > 0 ? viewsResult[0].totalViews : 0;
    
    // Get total users count
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalPosts,
        publishedPosts,
        draftPosts,
        featuredPosts,
        totalViews,
        totalUsers,
        monthlyPosts: Math.floor(totalPosts / 12), // Estimate
        monthlyViews: Math.floor(totalViews / 12) // Estimate
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stats'
    });
  }
};