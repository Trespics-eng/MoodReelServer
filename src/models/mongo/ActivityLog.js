import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  videoId: {
    type: String,
    default: null
  },
  action: {
    type: String,
    enum: ['watch', 'search', 'like', 'save', 'upload', 'share'],
    required: true,
    index: true
  },
  category: {
    type: String,
    default: null
  },
  searchQuery: {
    type: String,
    default: null
  },
  platform: {
    type: String,
    enum: ['youtube', 'vimeo', 'uploaded', null],
    default: null
  },
  watchDuration: {
    type: Number, // seconds watched
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for recommendation queries
activityLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, category: 1 });
activityLogSchema.index({ timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
