import Video from '../models/mongo/Video.js';
import { isMongoConnected } from '../config/database.js';
import YouTubeService from './youtubeService.js';
import VimeoService from './vimeoService.js';
import MovieService from './movieService.js';
import _ from 'lodash';
import Fuse from 'fuse.js';

const CATEGORIES = [
  'trending', 'coding', 'education', 'tutorials', 'agriculture', 'sports', 'music', 'instrumentals',
  'gaming', 'technology', 'film'
];

const CATEGORY_SEARCH_QUERIES = {
  coding: 'java python html css javascript coding tutorial programming direct',
  education: 'learn education lectures school science academic',
  tutorials: 'how to tutorial guide step by step walkthrough',
  agriculture: 'farming agriculture crops livestock sustainable farming',
  sports: 'football basketball nba highlights sports soccer tennis',
  music: 'music video songs live performance hits concert',
  instrumentals: 'instrumental music beats background music lo-fi',
  gaming: 'gaming highlights gameplay walkthrough video games twitch',
  technology: 'tech reviews gadgets future technology innovations software',
  film: 'movie trailers short films cinema filmmaking behind the scenes'
};

// ─── Seed data for demo when no API keys ───────────────────────
const VideoService = {
  // Get all categories
  getCategories() {
    return CATEGORIES;
  },

  // Unified search across all sources
  async search(query, { category = '', platform = '', page = 1, limit = 20 } = {}) {
    const results = [];
    console.log(`🎬 Video fetch started: query="${query || ''}", category="${category}", platform="${platform}"`);

    // 1. Search MongoDB (cached + uploaded)
    if (isMongoConnected()) {
      try {
        const mongoQuery = {};
        if (query) {
          mongoQuery.$or = [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
          ];
        }
        if (category) mongoQuery.category = category;
        if (platform) mongoQuery.platform = platform;

        const cached = await Video.find(mongoQuery)
          .sort({ views: -1 })
          .limit(limit)
          .lean();
        
        if (cached.length > 0) {
          console.log(`📦 Found ${cached.length} videos in MongoDB (cached/uploaded)`);
          results.push(...cached);
        }
      } catch (e) {
        console.error('❌ MongoDB search failed:', e.message);
      }
    }

    let needsMore = results.length < limit;

    // 2. Search YouTube API
    if (needsMore && (!platform || platform === 'youtube')) {
      try {
        const fetchLimit = Math.min(limit - results.length, 12);
        const ytResults = await YouTubeService.search(query || 'trending', { maxResults: fetchLimit, category });
        if (ytResults.videos.length) {
          console.log(`📹 Found ${ytResults.videos.length} videos from YouTube API`);
          results.push(...ytResults.videos);
          YouTubeService.cacheVideos(ytResults.videos).catch(() => {});
          if (results.length >= limit) needsMore = false;
        }
      } catch (e) {
        console.error('❌ YouTube search failed:', e.message);
      }
    }

    // 3. Search Vimeo API
    if (needsMore && (!platform || platform === 'vimeo')) {
      try {
        const fetchLimit = Math.min(limit - results.length, 12);
        const vmResults = await VimeoService.search(query || 'popular', { maxResults: fetchLimit, category });
        if (vmResults.videos.length) {
          console.log(`💎 Found ${vmResults.videos.length} videos from Vimeo API`);
          results.push(...vmResults.videos);
          VimeoService.cacheVideos(vmResults.videos).catch(() => {});
        }
      } catch (e) {
        console.error('❌ Vimeo search failed:', e.message);
      }
    }

    // 4. Search Movies (TMDB + OMDB)
    if (needsMore && (!platform || platform === 'tmdb' || platform === 'omdb')) {
      try {
        const fetchLimit = Math.min(limit - results.length, 12);
        const movieResults = await MovieService.search(query || 'popular', { maxResults: fetchLimit });
        if (movieResults.videos.length) {
          console.log(`🎬 Found ${movieResults.videos.length} items from Movie APIs (TMDB/OMDB)`);
          results.push(...movieResults.videos);
          MovieService.cacheMovies(movieResults.videos).catch(() => {});
        }
      } catch (e) {
        console.error('❌ Movie search failed:', e.message);
      }
    }

    // If no results from any source, use seed data + fuzzy fallback
    if (results.length === 0) {
      console.log('🌱 No live results found. Falling back to Fuzzy Seed Data.');
      let seeds = [...SEED_VIDEOS];
      
      if (query) {
        const fuse = new Fuse(seeds, {
          keys: ['title', 'description', 'category'],
          threshold: 0.4
        });
        const fuzzyResults = fuse.search(query).map(r => r.item);
        if (fuzzyResults.length > 0) {
          seeds = fuzzyResults;
        } else {
          // Fallback to basic include if fuzzy is too strict
          seeds = seeds.filter(v => 
            v.title.toLowerCase().includes(query.toLowerCase()) || 
            v.description.toLowerCase().includes(query.toLowerCase())
          );
        }
      }
      
      if (category) seeds = seeds.filter(v => v.category === category);
      if (platform) seeds = seeds.filter(v => v.platform === platform);
      results.push(...seeds);
    }

    // Deduplicate by videoId
    const unique = _.uniqBy(results, 'videoId');

    // Paginate
    const start = (page - 1) * limit;
    return {
      videos: unique.slice(start, start + limit),
      total: unique.length,
      page,
      hasMore: unique.length > start + limit
    };
  },

  // Get videos by category
  async getByCategory(category, { page = 1, limit = 20, sort = 'views' } = {}) {
    const query = CATEGORY_SEARCH_QUERIES[category] || '';
    const result = await this.search(query, { category, page, limit });
    
    if (sort === 'recent') {
      result.videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } else {
      result.videos.sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    return result;
  },

  // Get most watched videos
  async getMostWatched({ limit = 20 } = {}) {
    let videos = [];
    console.log(`🔥 Fetching most watched videos (limit: ${limit})`);

    try {
      if (isMongoConnected()) {
        videos = await Video.find({})
          .sort({ views: -1 })
          .limit(limit)
          .lean();
      }
    } catch (e) {
      console.error('❌ Error fetching most watched from MongoDB:', e.message);
    }

    if (videos.length < limit) {
      console.log(`⚡ Supplementing most watched with YouTube Trending (${limit - videos.length} needed)`);
      const trending = await YouTubeService.getTrending({ maxResults: limit - videos.length });
      videos.push(...trending);
    }

    if (videos.length === 0) {
      console.warn('⚠️ No recorded stats found. Returning top seed videos.');
      videos = [...SEED_VIDEOS].sort((a, b) => b.views - a.views).slice(0, limit);
    }

    return _.uniqBy(videos, 'videoId');
  },

  // Get single video by ID
  async getById(videoId) {
    console.log(`🔎 Video fetch by ID: ${videoId}`);
    // Check MongoDB first
    try {
      if (isMongoConnected()) {
        const cached = await Video.findOne({ videoId }).lean();
        if (cached) {
          console.log(`📦 Serving video ${videoId} from MongoDB cache`);
          return cached;
        }
      }
    } catch (e) {}

    // Check TMDB or OMDB
    if (videoId.startsWith('tmdb_') || videoId.startsWith('omdb_')) {
      try {
        const movie = await MovieService.getDetails(videoId);
        if (movie) {
          console.log(`🎬 Serving movie ${videoId} from API`);
          return movie;
        }
      } catch (e) {}
    }

    // Check YouTube
    if (!videoId.startsWith('vimeo_')) {
      try {
        const ytVideo = await YouTubeService.getVideo(videoId);
        if (ytVideo) {
          console.log(`📹 Serving video ${videoId} from YouTube API`);
          YouTubeService.cacheVideos([ytVideo]).catch(() => {});
          return ytVideo;
        }
      } catch (e) {}
    }

    // Check Vimeo
    if (videoId.startsWith('vimeo_')) {
      try {
        const vmVideo = await VimeoService.getVideo(videoId);
        if (vmVideo) {
          console.log(`💎 Serving video ${videoId} from Vimeo API`);
          VimeoService.cacheVideos([vmVideo]).catch(() => {});
          return vmVideo;
        }
      } catch (e) {}
    }

    // Check seed data
    const seed = SEED_VIDEOS.find(v => v.videoId === videoId);
    if (seed) console.log(`🌱 Serving video ${videoId} from Seed Data`);
    return seed || null;
  },

  // Get videos for homepage (by category)
  async getHomepageData() {
    const categories = CATEGORIES;
    console.log('🏠 Aggregating homepage category rows');

    const results = await Promise.all(
      categories.map(async (cat) => {
        try {
          const res = await this.getByCategory(cat, { limit: 15 });
          if (res.videos.length > 0) {
            return {
              category: cat,
              title: cat === 'tutorials' ? 'Course Tutorials' : cat.charAt(0).toUpperCase() + cat.slice(1),
              videos: res.videos
            };
          }
          return null;
        } catch (e) {
          console.error(`❌ Category aggregation fail [${cat}]:`, e.message);
          return null;
        }
      })
    );

    const rows = results.filter(Boolean);

    // 🏠 Add Movie Row to Homepage
    try {
      const trendingMovies = await MovieService.getTrending({ limit: 15 });
      if (trendingMovies.length > 0) {
        rows.unshift({
          category: 'movies',
          title: 'Featured Movies',
          videos: trendingMovies
        });
      }
    } catch (e) {
      console.error('❌ Failed to add movie row to homepage:', e.message);
    }

    // If no rows, use seed data grouped by category
    if (rows.length === 0) {
      console.warn('⚠️ No live category data found. Using grouped seed data.');
      const grouped = _.groupBy(SEED_VIDEOS, 'category');
      for (const [cat, vids] of Object.entries(grouped)) {
        rows.push({
          category: cat,
          title: cat.charAt(0).toUpperCase() + cat.slice(1),
          videos: vids
        });
      }
    }

    return rows;
  },

  // Get hero/featured videos
  async getFeatured({ limit = 6 } = {}) {
    return await this.getMostWatched({ limit });
  },

  // Increment view count
  async incrementViews(videoId) {
    try {
      if (isMongoConnected()) {
        await Video.updateOne({ videoId }, { $inc: { views: 1 } });
      }
    } catch (e) {}
  },

  // Get related videos
  async getRelated(videoId, { limit = 12 } = {}) {
    const video = await this.getById(videoId);
    if (!video) return [];

    const result = await this.search(video.title?.split(' ').slice(0, 3).join(' '), {
      category: video.category,
      limit
    });

    return result.videos.filter(v => v.videoId !== videoId);
  },

  // Get all categories with counts
  async getCategoriesWithCounts() {
    const counts = {};
    
    try {
      if (isMongoConnected()) {
        const pipeline = [
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ];
        const result = await Video.aggregate(pipeline);
        result.forEach(r => { counts[r._id] = r.count; });
      } else {
        throw new Error('MongoDB not connected');
      }
    } catch (e) {
      console.warn('⚠️ Falling back to seed data categories');
      SEED_VIDEOS.forEach(v => {
        counts[v.category] = (counts[v.category] || 0) + 1;
      });
    }

    return CATEGORIES.map(cat => ({
      name: cat,
      label: cat === 'tutorials' ? 'Course Tutorials' : cat.charAt(0).toUpperCase() + cat.slice(1),
      count: counts[cat] || 0
    }));
  },

  // Get search suggestions (fuzzy)
  async getSuggestions(query, limit = 10) {
    if (!query) return [];
    
    let pool = [...SEED_VIDEOS];
    
    // Supplement pool with MongoDB titles if available
    try {
      if (isMongoConnected()) {
        const recentVideos = await Video.find({})
          .sort({ views: -1 })
          .limit(100)
          .select('title category platform')
          .lean();
        pool = _.uniqBy([...recentVideos, ...pool], 'title');
      }
    } catch (e) {}

    const fuse = new Fuse(pool, {
      keys: ['title'],
      threshold: 0.3,
      distance: 100
    });

    return fuse.search(query)
      .slice(0, limit)
      .map(r => ({
        text: r.item.title,
        category: r.item.category,
        platform: r.item.platform
      }));
  }
};

export default VideoService;
