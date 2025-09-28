const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title_en: {
    type: String,
    trim: true,
    maxlength: [500, 'Title cannot be more than 500 characters']
  },
  title_np: {
    type: String,
    trim: true,
    maxlength: [500, 'Title cannot be more than 500 characters']
  },
  content_en: {
    type: String
  },
  content_np: {
    type: String
  },
  excerpt_en: {
    type: String,
    maxlength: [1000, 'Excerpt cannot be more than 1000 characters']
  },
  excerpt_np: {
    type: String,
    maxlength: [1000, 'Excerpt cannot be more than 1000 characters']
  },
  category: {
    type: String,
    enum: [
      'technology',
      'digitalTransformation',
      'socialJustice',
      'events',
      'innovation',
      'policy',
      'education',
      'startups'
    ]
  },
  image: {
    type: String, // Will store the file path like '/uploads/posts/filename.jpg'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: String, // Store user IDs or anonymous identifiers
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: {
      type: String,
      maxlength: [1000, 'Comment cannot be more than 1000 characters']
    },
    userName: {
      type: String,
      default: 'Anonymous'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create indexes for better performance
postSchema.index({ category: 1 });
postSchema.index({ featured: 1 });
postSchema.index({ published: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ title_en: 'text', content_en: 'text', excerpt_en: 'text' });

module.exports = mongoose.model('Post', postSchema);