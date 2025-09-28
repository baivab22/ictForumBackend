const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const path = require('path');

// CORS Configuration - MUST come before helmet and other middleware
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://ictforum-frontend-j4i4dhx0i-baivabs-projects-31f870fd.vercel.app','https://www.ictforumnepal.com/'
        ]
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3001'
        ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-requested-with',
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Modified helmet configuration to work with CORS
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https:"],
    },
  },
}));

// Body parser - should come after CORS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - Apply after CORS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// YouTube API Configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyB6YV3Zyma0ZoPNM71K_VwJ2ZORRYcPsGg';
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCb_QJWvlOVZSIhLyoBiLZ4Q';

// Helper function to make YouTube API calls with better error handling
const makeYouTubeAPICall = async (url) => {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API Error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`YouTube API Error: ${data.error.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.error('YouTube API Call Failed:', error);
    throw error;
  }
};

// Add CORS headers explicitly to all API routes
app.use('/api/*', (req, res, next) => {
  // Log the request for debugging
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  
  // Set CORS headers explicitly
  const origin = req.get('Origin');
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://ictforum-frontend-j4i4dhx0i-baivabs-projects-31f870fd.vercel.app', 'https://www.ictforumnepal.com/']
    : [
        'http://localhost:3000', 
        'http://localhost:5173', 
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3001'
      ];
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with, Accept, Origin, X-Requested-With');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// YouTube API endpoint - Enhanced with better error handling
app.get('/api/youtube/videos', async (req, res) => {
  try {
    const maxResults = Math.min(parseInt(req.query.maxResults) || 6, 50); // Limit to max 50
    
    console.log(`Fetching YouTube videos for channel: ${YOUTUBE_CHANNEL_ID}`);
    
    // Step 1: Get channel info
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet,statistics&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`;
    console.log('Channel API URL:', channelUrl);
    
    const channelData = await makeYouTubeAPICall(channelUrl);
    
    if (!channelData.items?.length) {
      console.error('No channel found with ID:', YOUTUBE_CHANNEL_ID);
      return res.status(404).json({ 
        success: false,
        error: 'Channel not found',
        channelId: YOUTUBE_CHANNEL_ID 
      });
    }
    
    const channelInfo = channelData.items[0];
    const uploadsPlaylistId = channelInfo?.contentDetails?.relatedPlaylists?.uploads;
    const channelTitle = channelInfo?.snippet?.title;
    const subscriberCount = channelInfo?.statistics?.subscriberCount;
    
    console.log('Channel found:', channelTitle);
    console.log('Uploads playlist ID:', uploadsPlaylistId);
    
    if (!uploadsPlaylistId) {
      return res.status(404).json({ 
        success: false,
        error: 'No uploads playlist found for this channel' 
      });
    }
    
    // Step 2: Get videos from uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    console.log('Playlist API URL:', playlistUrl);
    
    const videosData = await makeYouTubeAPICall(playlistUrl);
    
    if (!videosData.items?.length) {
      console.log('No videos found in uploads playlist');
      return res.json({ 
        success: true,
        videos: [], 
        channelTitle,
        channelInfo: {
          title: channelTitle,
          subscriberCount: subscriberCount || 'Hidden'
        }
      });
    }
    
    console.log(`Found ${videosData.items.length} videos`);





    
    // Step 3: Get video statistics
    const videoIds = videosData.items
      .map(item => item.snippet?.resourceId?.videoId)
      .filter(Boolean);
    
    if (videoIds.length === 0) {
      return res.json({ 
        success: true,
        videos: [], 
        channelTitle,
        error: 'No valid video IDs found'
      });
    }
    
    const videoIdsString = videoIds.join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIdsString}&key=${YOUTUBE_API_KEY}`;
    console.log('Stats API URL:', statsUrl);
    
    let statsData = { items: [] };
    try {
      statsData = await makeYouTubeAPICall(statsUrl);
    } catch (error) {
      console.warn('Failed to fetch video statistics, proceeding without stats:', error.message);
    }
    
    // Step 4: Combine data
    const videos = videosData.items
      .filter(video => video.snippet?.resourceId?.videoId)
      .map(video => {
        const videoId = video.snippet.resourceId.videoId;
        const stats = statsData.items?.find(stat => stat.id === videoId) || {};
        
        return {
          id: videoId,
          title: video.snippet.title || 'Untitled Video',
          description: video.snippet.description || '',
          thumbnail: video.snippet.thumbnails?.maxres?.url || 
                    video.snippet.thumbnails?.high?.url || 
                    video.snippet.thumbnails?.medium?.url ||
                    video.snippet.thumbnails?.default?.url ||
                    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          publishedAt: video.snippet.publishedAt,
          channelTitle: video.snippet.channelTitle || channelTitle,
          viewCount: stats?.statistics?.viewCount || '0',
          likeCount: stats?.statistics?.likeCount || '0',
          commentCount: stats?.statistics?.commentCount || '0',
          duration: stats?.contentDetails?.duration || '',
          url: `https://www.youtube.com/watch?v=${videoId}`
        };
      });
    
    console.log(`Successfully processed ${videos.length} videos`);
    
    res.json({ 
      success: true,
      videos,
      channelTitle,
      channelInfo: {
        title: channelTitle,
        subscriberCount: subscriberCount || 'Hidden',
        videoCount: channelInfo?.statistics?.videoCount || 'Unknown'
      },
      meta: {
        totalVideos: videos.length,
        requestedCount: maxResults,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('YouTube API Error:', error);
    
    // Provide detailed error response
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: {
        channelId: YOUTUBE_CHANNEL_ID,
        apiKey: YOUTUBE_API_KEY ? `${YOUTUBE_API_KEY.substring(0, 10)}...` : 'Missing',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Additional YouTube API endpoints for debugging
app.get('/api/youtube/channel-info', async (req, res) => {
  try {
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`;
    const channelData = await makeYouTubeAPICall(channelUrl);
    
    res.json({
      success: true,
      channel: channelData.items?.[0] || null,
      apiUsed: channelUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to verify API key
app.get('/api/youtube/test', async (req, res) => {
  try {
    const testUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(testUrl);
    const data = await response.json();
    
    res.json({
      success: response.ok,
      status: response.status,
      data: data,
      message: response.ok ? 'API key is valid' : 'API key validation failed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working',
    origin: req.get('Origin'),
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

// Health check route - Enhanced
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ICT Forum Nepal API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: req.get('Origin'),
      allowedOrigins: process.env.NODE_ENV === 'production' 
        ? ['https://ictforum-frontend-j4i4dhx0i-baivabs-projects-31f870fd.vercel.app', 'https://www.ictforumnepal.com/']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001']
    },
    youtube: {
      apiKey: YOUTUBE_API_KEY ? 'Configured' : 'Missing',
      channelId: YOUTUBE_CHANNEL_ID ? 'Configured' : 'Missing'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});



    // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`YouTube API configured for channel: ${YOUTUBE_CHANNEL_ID}`);
  console.log(`API Key status: ${YOUTUBE_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`CORS enabled for: ${process.env.NODE_ENV === 'production' ? 'production domains' : 'localhost development'}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;