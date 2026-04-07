import axios from 'axios';
import Video from '../models/mongo/Video.js';
import { isMongoConnected } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const OMDB_API_BASE = 'http://www.omdbapi.com/';

const OmdbService = {
  isConfigured() {
    return !!process.env.OMDB_API_KEY;
  },

  // Format OMDB movie to our Video model
  formatMovie(movie, category = 'movie') {
    return {
      videoId: `omdb_${movie.imdbID}`,
      title: movie.Title,
      description: movie.Plot || '',
      thumbnail: movie.Poster !== 'N/A' ? movie.Poster : '',
      duration: 'Movie',
      durationSeconds: 0,
      platform: 'omdb',
      category: category,
      views: 0, // OMDB doesn't provide popularity/views
      likes: 0,
      rating: parseFloat(movie.imdbRating) || 0,
      releaseDate: movie.Released || movie.Year || '',
      channelName: 'OMDB',
      publishedAt: movie.Released ? new Date(movie.Released) : new Date(),
      source: 'api'
    };
  },

  // Search OMDB
  async search(query, { page = 1 } = {}) {
    if (!this.isConfigured() || !query) return { videos: [], total: 0 };

    try {
      console.log(`🎬 OMDB Search: "${query}" (page: ${page})`);
      const res = await axios.get(OMDB_API_BASE, {
        params: {
          apikey: process.env.OMDB_API_KEY,
          s: query,
          page,
          type: 'movie'
        }
      });

      if (res.data.Response === 'False') {
        return { videos: [], total: 0 };
      }

      const videos = (res.data.Search || []).map(m => this.formatMovie(m));
      return {
        videos,
        total: parseInt(res.data.totalResults) || 0,
        page
      };
    } catch (error) {
      console.error('❌ OMDB search error:', error.message);
      return { videos: [], total: 0 };
    }
  },

  // Get popular/trending movies for OMDB (generic search fallback)
  async getPopular({ page = 1 } = {}) {
    if (!this.isConfigured()) return [];
    
    // OMDB doesn't have a "trending" endpoint, so we search for a common year or keyword
    const queries = ['2024', '2023', 'Marvel', 'Warner', 'Action'];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    
    const res = await this.search(randomQuery, { page });
    return res.videos;
  },

  // Get details
  async getDetails(imdbID) {
    if (!this.isConfigured()) return null;

    try {
      const id = imdbID.startsWith('omdb_') ? imdbID.replace('omdb_', '') : imdbID;
      console.log(`🎬 OMDB: Fetching details for ${id}`);
      
      const res = await axios.get(OMDB_API_BASE, {
        params: {
          apikey: process.env.OMDB_API_KEY,
          i: id,
          plot: 'full'
        }
      });

      if (res.data.Response === 'False') return null;

      const data = res.data;
      const formatted = this.formatMovie(data);
      
      // Additional mapping for the premium details page
      return {
        ...formatted,
        overview: data.Plot,
        tagline: '', // OMDB doesn't have taglines
        runtime: parseInt(data.Runtime) || 0,
        genres: data.Genre ? data.Genre.split(', ').map((name, i) => ({ id: i, name })) : [],
        backdrop: null, // OMDB doesn't have backdrops
        cast: data.Actors ? data.Actors.split(', ').map((name, i) => ({ id: i, name, character: 'Cast', profile_path: null })) : [],
        trailerUrl: null,
        status: 'Released',
        director: data.Director,
        writer: data.Writer,
        awards: data.Awards
      };
    } catch (error) {
      console.error('❌ OMDB details error:', error.message);
      return null;
    }
  },

  // Cache movies
  async cacheMovies(movies) {
    try {
      if (!movies.length) return;
      if (!isMongoConnected()) return;

      console.log(`💾 Caching ${movies.length} OMDB movies to MongoDB`);
      const ops = movies.map(v => ({
        updateOne: {
          filter: { videoId: v.videoId, platform: 'omdb' },
          update: { $set: { ...v, cachedAt: new Date() } },
          upsert: true
        }
      }));
      await Video.bulkWrite(ops);
    } catch (error) {
      console.error('❌ OMDB cache error:', error.message);
    }
  }
};

export default OmdbService;
