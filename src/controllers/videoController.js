import VideoService from '../services/videoService.js';
import UploadService from '../services/uploadService.js';
import UploadedVideoModel from '../models/sql/UploadedVideo.js';
import RecommendationService from '../services/recommendationService.js';

const videoController = {
  // GET /api/videos — search & list
  async getVideos(req, res) {
    try {
      const { search, category, platform, page = 1, limit = 20 } = req.query;
      console.log(`🔍 Video search requested: query="${search || ''}", cat="${category || 'all'}", plat="${platform || 'all'}"`);
      
      const result = await VideoService.search(search || '', {
        category, platform, page: parseInt(page), limit: parseInt(limit)
      });

      // Log search activity if user is authenticated
      if (req.user && search) {
        RecommendationService.logActivity(req.user.id, {
          action: 'search', searchQuery: search, category
        }).catch(err => console.error('⚠️ Failed to log search activity:', err.message));
      }

      console.log(`✅ Returned ${result.videos.length} videos for search`);
      res.json(result);
    } catch (error) {
      console.error('❌ getVideos error:', error.message, { query: req.query });
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  },

  // GET /api/videos/homepage — homepage data with category rows
  async getHomepage(req, res) {
    try {
      console.log('🏠 Fetching homepage data...');
      const rows = await VideoService.getHomepageData();
      const featured = await VideoService.getFeatured({ limit: 6 });
      
      console.log(`✅ Homepage data loaded: ${rows.length} rows, ${featured.length} featured`);
      res.json({ 
        message: 'Homepage data fetched successfully',
        featured, 
        rows 
      });
    } catch (error) {
      console.error('❌ getHomepage error:', error.message);
      res.status(500).json({ error: 'Failed to fetch homepage data' });
    }
  },

  // GET /api/videos/most-watched
  async getMostWatched(req, res) {
    try {
      const { limit = 20 } = req.query;
      console.log(`🔥 Fetching top ${limit} most watched videos`);
      
      const videos = await VideoService.getMostWatched({ limit: parseInt(limit) });
      
      console.log(`✅ Returned ${videos.length} most watched videos`);
      res.json({ 
        message: 'Most watched videos fetched successfully',
        videos 
      });
    } catch (error) {
      console.error('❌ getMostWatched error:', error.message);
      res.status(500).json({ error: 'Failed to fetch most watched videos' });
    }
  },

  // GET /api/videos/categories
  async getCategories(req, res) {
    try {
      console.log('📂 Fetching all video categories');
      const categories = await VideoService.getCategoriesWithCounts();
      
      console.log(`✅ Returned ${categories.length} categories`);
      res.json({ categories });
    } catch (error) {
      console.error('❌ getCategories error:', error.message);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  },

  // GET /api/videos/category/:category
  async getByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20, sort = 'views' } = req.query;
      console.log(`📁 Fetching category: "${category}" (sort: ${sort}, page: ${page})`);
      
      const result = await VideoService.getByCategory(category, {
        page: parseInt(page), limit: parseInt(limit), sort
      });
      
      console.log(`✅ Returned ${result.videos.length} videos for category ${category}`);
      res.json(result);
    } catch (error) {
      console.error(`❌ getByCategory error [${req.params.category}]:`, error.message);
      res.status(500).json({ error: 'Failed to fetch category videos' });
    }
  },

  // GET /api/videos/:id
  async getById(req, res) {
    try {
      console.log(`📺 Fetching video details: ${req.params.id}`);
      const video = await VideoService.getById(req.params.id);
      
      if (!video) {
        console.warn(`⚠️ Video not found: ${req.params.id}`);
        return res.status(404).json({ error: 'Video not found' });
      }

      // Increment views (silent fail)
      VideoService.incrementViews(req.params.id).catch(err => console.error('⚠️ View count update failed:', err.message));
      UploadedVideoModel.incrementViews(req.params.id).catch(() => {});

      // Log watch activity
      if (req.user) {
        RecommendationService.logActivity(req.user.id, {
          action: 'watch', videoId: req.params.id, category: video.category, platform: video.platform
        }).catch(err => console.error('⚠️ Watch activity log failed:', err.message));
      }

      // Get related videos
      console.log(`🔗 Fetching related videos for: ${req.params.id}`);
      const related = await VideoService.getRelated(req.params.id, { limit: 12 });

      console.log(`✅ Details and ${related.length} related videos for: ${video.title}`);
      res.json({ video, related });
    } catch (error) {
      console.error(`❌ getById error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  },

  // POST /api/videos/upload
  async upload(req, res) {
    try {
      if (!req.file) {
        console.warn('⚠️ Video upload attempted without file');
        return res.status(400).json({ error: 'No video file provided' });
      }

      const { title, description, category, language } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      console.log(`☁️ Starting video upload: "${title}" by User ${req.user.id}`);
      const result = await UploadService.uploadVideo(req.file, {
        userId: req.user.id,
        title,
        description,
        category,
        language
      });

      console.log(`✅ Video uploaded successfully: ${result.videoId}`);
      res.status(201).json({ message: 'Video uploaded successfully', video: result });
    } catch (error) {
      console.error('❌ upload error:', error.message);
      res.status(500).json({ error: 'Failed to upload video' });
    }
  },

  // DELETE /api/videos/:id
  async deleteVideo(req, res) {
    try {
      console.log(`🗑️ Deletion requested for video: ${req.params.id} by User ${req.user.id}`);
      await UploadService.deleteVideo(req.params.id, req.user.id);
      
      console.log(`✅ Video deleted: ${req.params.id}`);
      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      console.error(`❌ deleteVideo error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  },

  // PUT /api/videos/:id
  async updateVideo(req, res) {
    try {
      const { id } = req.params;
      const { title, description, category, language } = req.body;
      
      console.log(`📝 Updating video: ${id} by User ${req.user.id}`);
      const updated = await UploadService.updateVideo(id, req.user.id, {
        title, description, category, language
      });

      console.log(`✅ Video updated successfully: ${id}`);
      res.json({ message: 'Video updated successfully', video: updated });
    } catch (error) {
      console.error(`❌ updateVideo error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to update video' });
    }
  },

  // GET /api/videos/suggestions
  async getSuggestions(req, res) {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      
      const suggestions = await VideoService.getSuggestions(q);
      res.json(suggestions);
    } catch (error) {
      console.error('❌ getSuggestions error:', error.message);
      res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
  }
};

export default videoController;
