import UserModel from '../models/sql/User.js';
import UploadedVideoModel from '../models/sql/UploadedVideo.js';
import Video from '../models/mongo/Video.js';
import CharacterModel from '../models/sql/Character.js';
import RecommendationService from '../services/recommendationService.js';
import UploadService from '../services/uploadService.js';
import ActivityLog from '../models/mongo/ActivityLog.js';
import mongoose from 'mongoose';

const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const adminController = {
  // GET /api/admin/dashboard
  async getDashboard(req, res) {
    try {
      console.log('📊 Admin dashboard stats requested');
      const [totalUsers, totalUploads] = await Promise.all([
        UserModel.count(),
        UploadedVideoModel.count()
      ]);

      let totalCachedVideos = 0;
      let totalViews = 0;
      let viewsData = [];
      let categoryData = [];
      let topVideos = [];
      let recentActivity = [];

      try {
        if (mongoose.connection.readyState === 1) {
          totalCachedVideos = await Video.countDocuments();
          const viewsAgg = await Video.aggregate([
            { $group: { _id: null, total: { $sum: '$views' } } }
          ]);
          totalViews = viewsAgg[0]?.total || 0;

          // viewsData: sum activity logs by day of week for the last 7 days
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const dailyActivity = await ActivityLog.aggregate([
            { $match: { timestamp: { $gte: oneWeekAgo } } },
            { 
              $group: {
                _id: { 
                  dayOfWeek: { $dayOfWeek: "$timestamp" },
                  action: "$action"
                },
                count: { $sum: 1 }
              }
            }
          ]);

          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const todayDay = new Date().getDay();
          
          let tempViewsData = days.map(day => ({ name: day, views: 0, uploads: 0 }));
          dailyActivity.forEach(stat => {
            const dayName = days[stat._id.dayOfWeek - 1];
            const dayObj = tempViewsData.find(d => d.name === dayName);
            if (dayObj) {
              if (stat._id.action === 'watch') dayObj.views += stat.count;
              if (stat._id.action === 'upload') dayObj.uploads += stat.count;
            }
          });
          
          const pastDaysIndex = todayDay + 1;
          viewsData = [...tempViewsData.slice(pastDaysIndex), ...tempViewsData.slice(0, pastDaysIndex)];

          // categoryData: map video counts by category
          const categoryAgg = await Video.aggregate([
            { $group: { _id: "$category", value: { $sum: 1 } } },
            { $sort: { value: -1 } },
            { $limit: 6 }
          ]);
          categoryData = categoryAgg.map(cat => ({
            name: cat._id || 'Uncategorized',
            value: cat.value
          }));

          // Ensure percentage adds up nicely or just let rechart handle values directly
          
          // topVideos
          const topVideosDocs = await Video.find().sort({ views: -1 }).limit(4).lean();
          topVideos = topVideosDocs.map(v => {
            let viewsStr = v.views.toString();
            if (v.views >= 1000000) viewsStr = (v.views / 1000000).toFixed(1) + 'M';
            else if (v.views >= 1000) viewsStr = (v.views / 1000).toFixed(1) + 'K';
            
            return {
              title: v.title,
              views: viewsStr,
              uploader: v.channelName || (v.uploadedBy ? 'User' : 'Unknown'),
              growth: '+12%' // placeholder as we don't track growth explicitly yet
            };
          });

          // recentActivity
          const recentLogs = await ActivityLog.find().sort({ timestamp: -1 }).limit(6).lean();
          recentActivity = recentLogs.map(log => {
            let type = 'system';
            if (log.action === 'upload') type = 'video';
            if (log.action === 'watch') type = 'video';
            if (log.action === 'like' || log.action === 'save') type = 'user';
            
            let actionStr = `${log.action} performed`;
            if (log.action === 'watch') actionStr = 'Video watched';
            else if (log.action === 'upload') actionStr = 'Video uploaded';
            else if (log.action === 'like') actionStr = 'Video liked';
            
            return {
              action: actionStr,
              user: log.userId ? log.userId.substring(0, 8) + '...' : 'System',
              time: formatTimeAgo(log.timestamp),
              type
            };
          });
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch MongoDB stats for dashboard', e);
      }

      console.log('✅ Dashboard stats compiled');
      res.json({
        message: 'Dashboard data fetched successfully',
        stats: {
          totalUsers,
          totalVideos: totalCachedVideos + totalUploads,
          totalUploads,
          totalViews,
          totalCachedVideos
        },
        viewsData,
        categoryData,
        topVideos,
        recentActivity
      });
    } catch (error) {
      console.error('❌ getDashboard error:', error.message);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  },

  // GET /api/admin/users
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      console.log(`👥 Admin: Fetching users (page: ${page}, limit: ${limit}, search: "${search}")`);
      
      const result = await UserModel.findAll({
        page: parseInt(page), limit: parseInt(limit), search
      });
      
      console.log(`✅ Returned ${result.users.length} users`);
      res.json(result);
    } catch (error) {
      console.error('❌ getUsers error:', error.message);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  // DELETE /api/admin/users/:id
  async deleteUser(req, res) {
    try {
      console.log(`🛡️ Admin: Deleting user ${req.params.id}`);
      await UserModel.delete(req.params.id);
      
      console.log(`✅ User ${req.params.id} deleted`);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error(`❌ deleteUser error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },

  // PUT /api/admin/users/:id/ban
  async banUser(req, res) {
    try {
      console.log(`🛡️ Admin: Banning user ${req.params.id}`);
      const user = await UserModel.update(req.params.id, { is_active: false });
      
      console.log(`✅ User ${req.params.id} banned`);
      res.json({ message: 'User banned successfully', user });
    } catch (error) {
      console.error(`❌ banUser error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  },

  // PUT /api/admin/users/:id/unban
  async unbanUser(req, res) {
    try {
      console.log(`🛡️ Admin: Unbanning user ${req.params.id}`);
      const user = await UserModel.update(req.params.id, { is_active: true });
      
      console.log(`✅ User ${req.params.id} unbanned`);
      res.json({ message: 'User unbanned successfully', user });
    } catch (error) {
      console.error(`❌ unbanUser error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  },

  // GET /api/admin/videos
  async getVideos(req, res) {
    try {
      const { page = 1, limit = 20, category = '' } = req.query;
      console.log(`📁 Admin: Fetching uploads (page: ${page}, cat: "${category}")`);
      
      const result = await UploadedVideoModel.findAll({
        page: parseInt(page), limit: parseInt(limit), category
      });
      
      console.log(`✅ Returned ${result.videos.length} uploaded videos`);
      res.json(result);
    } catch (error) {
      console.error('❌ getVideos error:', error.message);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  },

  // DELETE /api/admin/videos/:id
  async deleteVideo(req, res) {
    try {
      console.log(`🛡️ Admin: Deleting video ${req.params.id}`);
      await UploadService.deleteVideo(req.params.id);
      
      console.log(`✅ Video ${req.params.id} deleted`);
      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      console.error(`❌ deleteVideo error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  },

  // GET /api/admin/activity
  async getActivity(req, res) {
    try {
      const { page = 1, limit = 50, userId = '' } = req.query;
      console.log(`📑 Admin: Fetching activity logs (userId: ${userId || 'all'})`);
      
      const result = await RecommendationService.getActivityLogs(
        userId || null, { page: parseInt(page), limit: parseInt(limit) }
      );
      
      console.log(`✅ Returned ${result.logs.length} activity logs`);
      res.json(result);
    } catch (error) {
      console.error('❌ getActivity error:', error.message);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  },

  // GET /api/admin/characters
  async getCharacters(req, res) {
    try {
      const { page = 1, limit = 50, search = '' } = req.query;
      console.log(`🎭 Admin: Fetching characters (page: ${page}, limit: ${limit}, search: "${search}")`);
      
      const result = await CharacterModel.findAll({
        page: parseInt(page), limit: parseInt(limit), search
      });
      
      console.log(`✅ Returned ${result.characters.length} characters`);
      res.json(result);
    } catch (error) {
      console.error('❌ getCharacters error:', error.message);
      res.status(500).json({ error: 'Failed to fetch characters' });
    }
  },

  // POST /api/admin/characters
  async createCharacter(req, res) {
    try {
      console.log('🎭 Admin: Creating preset character');
      const charData = {
        ...req.body,
        user_id: null, // Presets have no user_id
        is_public: true // Make available to everyone
      };

      const character = await CharacterModel.create(charData);
      console.log(`✅ Character created: ${character.id}`);
      res.status(201).json({ message: 'Character created', character });
    } catch (error) {
      console.error('❌ createCharacter error:', error.message);
      res.status(500).json({ error: 'Failed to create character' });
    }
  },

  // PUT /api/admin/characters/:id
  async updateCharacter(req, res) {
    try {
      console.log(`🎭 Admin: Updating character ${req.params.id}`);
      const character = await CharacterModel.update(req.params.id, req.body);
      console.log(`✅ Character updated: ${character.id}`);
      res.json({ message: 'Character updated', character });
    } catch (error) {
      console.error(`❌ updateCharacter error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to update character' });
    }
  },

  // DELETE /api/admin/characters/:id
  async deleteCharacter(req, res) {
    try {
      console.log(`🛡️ Admin: Deleting character ${req.params.id}`);
      await CharacterModel.delete(req.params.id);
      console.log(`✅ Character ${req.params.id} deleted`);
      res.json({ message: 'Character deleted successfully' });
    } catch (error) {
      console.error(`❌ deleteCharacter error [${req.params.id}]:`, error.message);
      res.status(500).json({ error: 'Failed to delete character' });
    }
  }
};

export default adminController;
