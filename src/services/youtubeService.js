import axios from 'axios';
import Video from '../models/mongo/Video.js';
import { isMongoConnected } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const CATEGORY_MAP = {
  music: '10',
  education: '27',
  sports: '17',
  entertainment: '24',
  gaming: '20',
  news: '25',
  science: '28',
  technology: '28',
  comedy: '23',
  film: '1',
  howto: '26',
  travel: '19',
  pets: '15',
  autos: '2'
};

// Parse ISO 8601 duration to human-readable
function parseDuration(iso) {
  if (!iso) return { formatted: '0:00', seconds: 0 };
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { formatted: '0:00', seconds: 0 };
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  const totalSeconds = h * 3600 + m * 60 + s;
  const formatted = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  return { formatted, seconds: totalSeconds };
}

// Format view count
function formatViews(count) {
  const n = parseInt(count || '0');
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const YouTubeService = {
  isConfigured() {
    return !!process.env.YOUTUBE_API_KEY;
  },

  // Search YouTube videos
  async search(query, { maxResults = 12, category = '', pageToken = '' } = {}) {
    if (!this.isConfigured()) {
      console.warn('⚠️ YouTube API Key missing. Skipping YouTube search.');
      return { videos: [], nextPageToken: null };
    }

    try {
      console.log(`🎬 YouTube API Search: "${query}" (max: ${maxResults})`);
      const params = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        key: process.env.YOUTUBE_API_KEY,
        videoEmbeddable: true,
        order: 'relevance'
      };

      if (category && CATEGORY_MAP[category.toLowerCase()]) {
        params.videoCategoryId = CATEGORY_MAP[category.toLowerCase()];
      }
      if (pageToken) params.pageToken = pageToken;

      const searchRes = await axios.get(`${YOUTUBE_API_BASE}/search`, { params });
      const items = searchRes.data.items || [];
      const videoIds = items.map(i => i.id.videoId).filter(Boolean).join(',');

      if (!videoIds) {
        console.log('ℹ️ YouTube search returned no video IDs');
        return { videos: [], nextPageToken: null };
      }

      // Get full details (duration, views, etc.)
      const detailsRes = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'contentDetails,statistics,snippet',
          id: videoIds,
          key: process.env.YOUTUBE_API_KEY
        }
      });

      const videos = (detailsRes.data.items || []).map(item => {
        const dur = parseDuration(item.contentDetails?.duration);
        return {
          videoId: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
          duration: dur.formatted,
          durationSeconds: dur.seconds,
          platform: 'youtube',
          category: category || 'general',
          views: parseInt(item.statistics?.viewCount || '0'),
          likes: parseInt(item.statistics?.likeCount || '0'),
          channelName: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          language: (item.snippet.defaultLanguage || 'en').split('-')[0],
          source: 'api'
        };
      });

      console.log(`✅ YouTube API returned ${videos.length} detailed results`);
      return {
        videos,
        nextPageToken: searchRes.data.nextPageToken || null
      };
    } catch (error) {
      console.error('❌ YouTube API search error:', error.response?.data?.error?.message || error.message);
      return { videos: [], nextPageToken: null };
    }
  },

  // Get trending/popular videos
  async getTrending({ maxResults = 12, category = '', regionCode = 'US' } = {}) {
    if (!this.isConfigured()) {
      console.warn('⚠️ YouTube API Key missing. Skipping YouTube trending fetch.');
      return [];
    }

    try {
      console.log(`🎬 YouTube API Trending fetch (region: ${regionCode}, max: ${maxResults})`);
      const params = {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults,
        regionCode,
        key: process.env.YOUTUBE_API_KEY
      };

      if (category && CATEGORY_MAP[category.toLowerCase()]) {
        params.videoCategoryId = CATEGORY_MAP[category.toLowerCase()];
      }

      const res = await axios.get(`${YOUTUBE_API_BASE}/videos`, { params });

      const videos = (res.data.items || []).map(item => {
        const dur = parseDuration(item.contentDetails?.duration);
        return {
          videoId: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails?.high?.url || '',
          duration: dur.formatted,
          durationSeconds: dur.seconds,
          platform: 'youtube',
          category: category || 'trending',
          views: parseInt(item.statistics?.viewCount || '0'),
          likes: parseInt(item.statistics?.likeCount || '0'),
          channelName: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          source: 'api'
        };
      });

      console.log(`✅ YouTube API returned ${videos.length} trending items`);
      return videos;
    } catch (error) {
      console.error('❌ YouTube trending error:', error.message);
      return [];
    }
  },

  // Get single video details
  async getVideo(videoId) {
    if (!this.isConfigured()) return null;

    try {
      console.log(`🎬 YouTube API Fetch Video ID: ${videoId}`);
      const res = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
          key: process.env.YOUTUBE_API_KEY
        }
      });

      const item = res.data.items?.[0];
      if (!item) {
        console.warn(`⚠️ YouTube video ${videoId} not found in API`);
        return null;
      }

      const dur = parseDuration(item.contentDetails?.duration);
      console.log(`✅ YouTube API returned details for: ${item.snippet.title}`);
      return {
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || '',
        duration: dur.formatted,
        durationSeconds: dur.seconds,
        platform: 'youtube',
        category: 'general',
        views: parseInt(item.statistics?.viewCount || '0'),
        likes: parseInt(item.statistics?.likeCount || '0'),
        channelName: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        source: 'api'
      };
    } catch (error) {
      console.error('❌ YouTube getVideo error:', error.message);
      return null;
    }
  },

  // Cache videos to MongoDB
  async cacheVideos(videos) {
    try {
      if (!videos.length) return;
      if (!isMongoConnected()) return;

      console.log(`💾 Caching ${videos.length} YouTube videos to MongoDB`);
      const ops = videos.map(v => ({
        updateOne: {
          filter: { videoId: v.videoId, platform: 'youtube' },
          update: { $set: { ...v, cachedAt: new Date() } },
          upsert: true
        }
      }));
      await Video.bulkWrite(ops);
      console.log('✅ Bulk cache write complete');
    } catch (error) {
      console.error('❌ YouTube cache error:', error.message);
    }
  }
};

export default YouTubeService;
