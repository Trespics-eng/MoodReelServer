import RecommendationService from '../services/recommendationService.js';

const recommendationController = {
  // GET /api/recommendations
  async getRecommendations(req, res) {
    try {
      const userId = req.user.id;
      console.log(`🤖 Fetching recommendations for User ${userId}`);
      
      const recommendations = await RecommendationService.getRecommendations(userId);
      
      console.log(`✅ Returned ${recommendations.length} recommendations`);
      res.json({ 
        message: 'Recommendations fetched successfully',
        recommendations 
      });
    } catch (error) {
      console.error('❌ getRecommendations error:', error.message);
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  },

  // POST /api/activity
  async logActivity(req, res) {
    try {
      const { videoId, action, category, searchQuery, platform, watchDuration } = req.body;
      
      if (!action) return res.status(400).json({ error: 'Action is required' });

      console.log(`📈 Logging activity: "${action}" for User ${req.user.id} ${videoId ? `on video ${videoId}` : ''}`);
      
      await RecommendationService.logActivity(req.user.id, {
        videoId, action, category, searchQuery, platform, watchDuration
      });

      res.json({ message: 'Activity logged successfully' });
    } catch (error) {
      console.error('❌ logActivity error:', error.message);
      res.status(500).json({ error: 'Failed to log activity' });
    }
  }
};

export default recommendationController;
