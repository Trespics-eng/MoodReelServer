import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: '0:00'
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  platform: {
    type: String,
    enum: ['youtube', 'vimeo', 'uploaded', 'tmdb', 'omdb'],
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  tags: [{
    type: String
  }],
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0
  },
  releaseDate: {
    type: String,
    default: ''
  },
  channelName: {
    type: String,
    default: ''
  },
  channelId: {
    type: String,
    default: ''
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  language: {
    type: String,
    default: 'en'
  },
  // For uploaded videos
  uploadedBy: {
    type: String, // userId from PostgreSQL
    default: null
  },
  videoUrl: {
    type: String, // Supabase URL for uploaded videos
    default: null
  },
  // For caching external API results
  source: {
    type: String,
    enum: ['api', 'cache', 'upload'],
    default: 'cache'
  },
  cachedAt: {
    type: Date,
    default: Date.now
  },
  // Quality options for uploaded videos
  qualities: [{
    label: String,    // '360p', '480p', '720p', '1080p'
    url: String,
    width: Number,
    height: Number
  }]
}, {
  timestamps: true
});

// Compound indexes for efficient queries
videoSchema.index({ platform: 1, category: 1 });
videoSchema.index({ views: -1 });
videoSchema.index({ publishedAt: -1 });
videoSchema.index({ title: 'text', description: 'text' });

// TTL index — auto-delete cached external videos after 24 hours
videoSchema.index({ cachedAt: 1 }, { 
  expireAfterSeconds: 86400, 
  partialFilterExpression: { source: 'cache' } 
});

const Video = mongoose.model('Video', videoSchema);

export default Video;
