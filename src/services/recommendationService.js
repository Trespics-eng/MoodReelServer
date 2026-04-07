import ActivityLog from '../models/mongo/ActivityLog.js';
import Recommendation from '../models/mongo/Recommendation.js';
import Video from '../models/mongo/Video.js';

const RecommendationService = {
  // Log user activity
  async logActivity(userId, { videoId, action, category, searchQuery, platform, watchDuration }) {
    try {
      await ActivityLog.create({
        userId, videoId, action, category, searchQuery, platform, watchDuration
      });
    } catch (error) {
      console.error('Activity log error:', error.message);
    }
  },

  // Generate recommendations for a user
  async generateRecommendations(userId) {
    try {
      // 1. Get user's activity history
      const activities = await ActivityLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(200)
        .lean();

      if (activities.length === 0) {
        return this.getDefaultRecommendations();
      }

      // 2. Build category interest scores
      const categoryScores = {};
      const watchedVideoIds = new Set();

      activities.forEach(act => {
        if (act.category) {
          const weight = act.action === 'watch' ? 3 :
                         act.action === 'like' ? 5 :
                         act.action === 'save' ? 4 :
                         act.action === 'search' ? 2 : 1;
          categoryScores[act.category] = (categoryScores[act.category] || 0) + weight;
        }
        if (act.videoId) watchedVideoIds.add(act.videoId);
      });

      // 3. Find videos in preferred categories that user hasn't watched
      const topCategories = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat);

      const candidateVideos = await Video.find({
        category: { $in: topCategories },
        videoId: { $nin: [...watchedVideoIds] }
      })
        .sort({ views: -1 })
        .limit(50)
        .lean();

      // 4. Score videos: weighted = (interest * 0.6) + (popularity * 0.3) + (recency * 0.1)
      const maxViews = Math.max(...candidateVideos.map(v => v.views || 1), 1);
      const now = Date.now();

      const scored = candidateVideos.map(video => {
        const interest = categoryScores[video.category] || 0;
        const maxInterest = Math.max(...Object.values(categoryScores), 1);
        const normalizedInterest = interest / maxInterest;

        const popularity = (video.views || 0) / maxViews;

        const ageMs = now - new Date(video.publishedAt || video.createdAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recency = Math.max(0, 1 - (ageDays / 365));

        const score = (normalizedInterest * 0.6) + (popularity * 0.3) + (recency * 0.1);

        return {
          videoId: video.videoId,
          score: Math.round(score * 100) / 100,
          reason: normalizedInterest > 0.5 ? 'interest' : popularity > 0.5 ? 'popular' : 'similar'
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const topRecommendations = scored.slice(0, 20);

      // 5. Cache recommendations
      await Recommendation.findOneAndUpdate(
        { userId },
        {
          userId,
          videos: topRecommendations,
          categoryScores: new Map(Object.entries(categoryScores)),
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );

      return topRecommendations;
    } catch (error) {
      console.error('Recommendation generation error:', error.message);
      return this.getDefaultRecommendations();
    }
  },

  // Get cached recommendations
  async getRecommendations(userId) {
    try {
      const cached = await Recommendation.findOne({ userId }).lean();
      
      if (cached && cached.videos?.length > 0) {
        return cached.videos;
      }

      // Generate fresh recommendations
      return await this.generateRecommendations(userId);
    } catch (error) {
      return this.getDefaultRecommendations();
    }
  },

  // Default recommendations (trending/popular)
  async getDefaultRecommendations() {
    try {
      const popular = await Video.find({})
        .sort({ views: -1 })
        .limit(20)
        .lean();

      return popular.map(v => ({
        videoId: v.videoId,
        score: 0.5,
        reason: 'popular'
      }));
    } catch (e) {
      return [];
    }
  },

  // Get user activity logs
  async getActivityLogs(userId, { page = 1, limit = 50 } = {}) {
    try {
      const skip = (page - 1) * limit;
      const logs = await ActivityLog.find(userId ? { userId } : {})
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await ActivityLog.countDocuments(userId ? { userId } : {});

      return { logs, total, page, hasMore: total > skip + limit };
    } catch (error) {
      return { logs: [], total: 0, page, hasMore: false };
    }
  }
};

export default RecommendationService;
