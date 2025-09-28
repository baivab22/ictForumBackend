const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title_en: {
    type: String,
    required: [true, 'English title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  title_np: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  content_en: {
    type: String,
    required: [true, 'English content is required']
  },
  content_np: {
    type: String
  },
  excerpt_en: {
    type: String,
    maxlength: [500, 'Excerpt cannot be more than 500 characters']
  },
  excerpt_np: {
    type: String,
    maxlength: [500, 'Excerpt cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
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
    type: String,
    default: 'admin'
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
  likes: {
    type: Number,
    default: 0
  },
  comments: [{
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot be more than 500 characters']
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