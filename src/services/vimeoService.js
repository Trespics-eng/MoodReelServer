import axios from 'axios';
import Video from '../models/mongo/Video.js';
import { isMongoConnected } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const VIMEO_API_BASE = 'https://api.vimeo.com';

// Convert Vimeo duration (seconds) to formatted string
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Map Vimeo categories to our category names
function mapCategory(vimeoCategories) {
  if (!vimeoCategories?.length) return 'general';
  const name = vimeoCategories[0].name?.toLowerCase() || '';
  const map = {
    'music': 'music', 'sports': 'sports', 'comedy': 'comedy',
    'education': 'education', 'agriculture': 'agriculture', 'film & animation': 'film',
    'entertainment': 'entertainment', 'travel': 'travel',
    'science & technology': 'technology', 'gaming': 'gaming',
    'news': 'news', 'howto': 'howto'
  };
  return map[name] || 'general';
}

const VimeoService = {
  isConfigured() {
    return !!process.env.VIMEO_ACCESS_TOKEN;
  },

  getHeaders() {
    return {
      Authorization: `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.vimeo.*+json;version=3.4'
    };
  },

  // Search Vimeo videos
  async search(query, { maxResults = 12, category = '', page = 1 } = {}) {
    if (!this.isConfigured()) return { videos: [], total: 0 };

    try {
      const params = {
        query,
        per_page: maxResults,
        page,
        sort: 'relevant',
        filter: 'playable'
      };

      if (category) params.categories = category;

      const res = await axios.get(`${VIMEO_API_BASE}/videos`, {
        headers: this.getHeaders(),
        params
      });

      const videos = (res.data.data || []).map(item => {
        const uri = item.uri?.replace('/videos/', '') || '';
        const bestPic = item.pictures?.sizes?.find(s => s.width >= 640) || item.pictures?.sizes?.[0];
        
        return {
          videoId: `vimeo_${uri}`,
          title: item.name || 'Untitled',
          description: item.description || '',
          thumbnail: bestPic?.link || '',
          duration: formatDuration(item.duration),
          durationSeconds: item.duration || 0,
          platform: 'vimeo',
          category: category || mapCategory(item.categories),
          views: item.stats?.plays || 0,
          likes: item.metadata?.connections?.likes?.total || 0,
          channelName: item.user?.name || '',
          channelId: item.user?.uri?.replace('/users/', '') || '',
          publishedAt: item.created_time,
          language: (item.language || 'en').split('-')[0],
          source: 'api'
        };
      });

      return {
        videos,
        total: res.data.total || 0
      };
    } catch (error) {
      console.error('Vimeo API error:', error.response?.data?.error || error.message);
      return { videos: [], total: 0 };
    }
  },

  // Get popular Vimeo videos
  async getPopular({ maxResults = 12, category = '' } = {}) {
    if (!this.isConfigured()) return [];

    try {
      const params = {
        per_page: maxResults,
        sort: 'plays',
        direction: 'desc',
        filter: 'playable'
      };

      const endpoint = category
        ? `${VIMEO_API_BASE}/categories/${category}/videos`
        : `${VIMEO_API_BASE}/videos`;

      const res = await axios.get(endpoint, {
        headers: this.getHeaders(),
        params
      });

      return (res.data.data || []).map(item => {
        const uri = item.uri?.replace('/videos/', '') || '';
        const bestPic = item.pictures?.sizes?.find(s => s.width >= 640) || item.pictures?.sizes?.[0];

        return {
          videoId: `vimeo_${uri}`,
          title: item.name || 'Untitled',
          description: item.description || '',
          thumbnail: bestPic?.link || '',
          duration: formatDuration(item.duration),
          durationSeconds: item.duration || 0,
          platform: 'vimeo',
          category: category || 'trending',
          views: item.stats?.plays || 0,
          likes: item.metadata?.connections?.likes?.total || 0,
          channelName: item.user?.name || '',
          publishedAt: item.created_time,
          source: 'api'
        };
      });
    } catch (error) {
      console.error('Vimeo popular error:', error.message);
      return [];
    }
  },

  // Get single video
  async getVideo(vimeoId) {
    if (!this.isConfigured()) return null;
    const id = vimeoId.replace('vimeo_', '');

    try {
      const res = await axios.get(`${VIMEO_API_BASE}/videos/${id}`, {
        headers: this.getHeaders()
      });

      const item = res.data;
      const bestPic = item.pictures?.sizes?.find(s => s.width >= 640) || item.pictures?.sizes?.[0];

      return {
        videoId: `vimeo_${id}`,
        title: item.name || 'Untitled',
        description: item.description || '',
        thumbnail: bestPic?.link || '',
        duration: formatDuration(item.duration),
        durationSeconds: item.duration || 0,
        platform: 'vimeo',
        category: mapCategory(item.categories),
        views: item.stats?.plays || 0,
        likes: item.metadata?.connections?.likes?.total || 0,
        channelName: item.user?.name || '',
        channelId: item.user?.uri?.replace('/users/', '') || '',
        publishedAt: item.created_time,
        source: 'api'
      };
    } catch (error) {
      console.error('Vimeo getVideo error:', error.message);
      return null;
    }
  },

  // Cache videos to MongoDB
  async cacheVideos(videos) {
    try {
      if (!videos.length) return;
      if (!isMongoConnected()) return;
      const ops = videos.map(v => ({
        updateOne: {
          filter: { videoId: v.videoId, platform: 'vimeo' },
          update: { $set: { ...v, cachedAt: new Date() } },
          upsert: true
        }
      }));
      await Video.bulkWrite(ops);
    } catch (error) {
      console.error('Vimeo cache error:', error.message);
    }
  }
};

export default VimeoService;
