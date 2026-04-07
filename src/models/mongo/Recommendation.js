import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  videos: [{
    videoId: String,
    score: Number,
    reason: {
      type: String,
      enum: ['interest', 'trending', 'similar', 'popular'],
      default: 'interest'
    }
  }],
  categoryScores: {
    type: Map,
    of: Number,
    default: {}
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// TTL — re-generate recommendations every 6 hours
recommendationSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 21600 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

export default Recommendation;
