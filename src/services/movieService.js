import Video from '../models/mongo/Video.js';
import { isMongoConnected } from '../config/database.js';
import OmdbService from './omdbService.js';
import _ from 'lodash';
import axios from 'axios';
import dotenv from 'dotenv';
import UploadedVideoModel from '../models/sql/UploadedVideo.js';

dotenv.config();

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const MovieService = {
  isConfigured() {
    return !!process.env.MOVIE_DATABASE;
  },

  // Helper to interleave two arrays
  interleave(arr1, arr2) {
    const result = [];
    const max = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < max; i++) {
      if (arr1[i]) result.push(arr1[i]);
      if (arr2[i]) result.push(arr2[i]);
    }
    return result;
  },

  // Format TMDB movie to our Video model
  formatMovie(movie, category = 'movie') {
    return {
      videoId: `tmdb_${movie.id}`,
      title: movie.title || movie.name,
      description: movie.overview,
      thumbnail: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : (movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : ''),
      duration: 'Movie', // Movies don't have a simple duration in the list API
      durationSeconds: 0,
      platform: 'tmdb',
      category: category,
      views: Math.floor(movie.popularity * 100), // Simulate views from popularity
      likes: Math.floor(movie.vote_count),
      rating: movie.vote_average,
      releaseDate: movie.release_date || movie.first_air_date || '',
      channelName: 'TMDB',
      publishedAt: movie.release_date ? new Date(movie.release_date) : new Date(),
      source: 'api'
    };
  },

  // Format Supabase uploaded video
  formatUploadedVideo(video) {
    return {
      videoId: video.video_id,
      title: video.title,
      description: video.description || '',
      thumbnail: video.video_url ? video.video_url.replace('.mp4', '.jpg') : '',
      duration: 'Movie',
      durationSeconds: 0,
      platform: 'uploaded',
      category: video.category || 'general',
      views: video.views || 0,
      likes: 0,
      rating: 5,
      releaseDate: video.created_at || '',
      channelName: 'User Upload',
      publishedAt: video.created_at ? new Date(video.created_at) : new Date(),
      source: 'upload',
      videoUrl: video.video_url
    };
  },

  // Get trending movies (Combines TMDB and OMDB)
  async getTrending({ page = 1 } = {}) {
    if (!this.isConfigured() && !OmdbService.isConfigured()) return [];

    let tmdbMovies = [];
    let omdbMovies = [];
    let uploadedMovies = [];

    // 0. Fetch Uploaded Videos (simulated trending for custom content)
    try {
      const uploads = await UploadedVideoModel.findAll({ page, limit: 10 });
      uploadedMovies = uploads.videos.map(v => this.formatUploadedVideo(v));
    } catch (e) {
      console.error('❌ Uploaded trending error:', e.message);
    }

    // 1. Fetch from TMDB
    if (this.isConfigured()) {
      try {
        console.log(`🎬 TMDB: Fetching trending movies (page: ${page})`);
        const res = await axios.get(`${TMDB_API_BASE}/trending/movie/week`, {
          params: {
            api_key: process.env.MOVIE_DATABASE,
            page
          }
        });
        tmdbMovies = (res.data.results || []).map(m => this.formatMovie(m, 'trending'));
      } catch (error) {
        console.error('❌ TMDB trending error:', error.message);
      }
    }

    // 2. Fetch from OMDB (using popular fallback)
    if (OmdbService.isConfigured()) {
      try {
        omdbMovies = await OmdbService.getPopular({ page });
      } catch (error) {
        console.error('❌ OMDB trending fallback error:', error.message);
      }
    }

    const external = this.interleave(tmdbMovies, omdbMovies);
    return _.uniqBy(this.interleave(uploadedMovies, external), 'title');
  },

  // Search movies across TMDB and OMDB
  async search(query, { page = 1 } = {}) {
    if (!this.isConfigured() && !OmdbService.isConfigured()) return { videos: [], total: 0 };
    if (!query) return { videos: [], total: 0 };

    const results = [];
    let totalResults = 0;

    // 0. Search Uploaded Videos
    try {
      // In-memory filter on total uploads for basic search
      const allUploads = await UploadedVideoModel.findAll({ limit: 100 });
      const matched = allUploads.videos.filter(v => v.title && v.title.toLowerCase().includes(query.toLowerCase()));
      results.push(...matched.map(v => this.formatUploadedVideo(v)));
      totalResults += matched.length;
    } catch (e) {
      console.error('❌ Uploaded search error:', e.message);
    }

    // 1. Search TMDB
    if (this.isConfigured()) {
      try {
        console.log(`🎬 TMDB Search: "${query}" (page: ${page})`);
        const res = await axios.get(`${TMDB_API_BASE}/search/movie`, {
          params: {
            api_key: process.env.MOVIE_DATABASE,
            query,
            page
          }
        });
        const tmdbVideos = (res.data.results || []).map(m => this.formatMovie(m));
        results.push(...tmdbVideos);
        totalResults += res.data.total_results || 0;
      } catch (error) {
        console.error('❌ TMDB search error:', error.message);
      }
    }

    // 2. Search OMDB as supplement
    if (OmdbService.isConfigured()) {
      try {
        const omdbRes = await OmdbService.search(query, { page });
        if (omdbRes.videos.length) {
          results.push(...omdbRes.videos);
          totalResults += omdbRes.total || 0;
        }
      } catch (error) {
        console.error('❌ OMDB search error:', error.message);
      }
    }

    // Interleave TMDB and OMDB if both produced results
    const uploadedRes = results.filter(v => v.platform === 'uploaded');
    const tmdbResults = results.filter(v => v.platform === 'tmdb');
    const omdbResults = results.filter(v => v.platform === 'omdb');
    
    // First interleave TMDB and OMDB
    let interleaved = this.interleave(tmdbResults, omdbResults);
    
    // Then interleave with uploaded results for highest exposure
    interleaved = this.interleave(uploadedRes, interleaved);

    // Deduplicate by title (rough) or just return combined
    const unique = _.uniqBy(interleaved, 'title');

    return {
      videos: unique,
      total: totalResults,
      page
    };
  },

  // Get movies by genre (Combines TMDB and OMDB)
  async getByGenre(genreId, { page = 1 } = {}) {
    if (!this.isConfigured() && !OmdbService.isConfigured()) return [];

    const results = [];
    const genreMap = {
      '28': 'Action', '12': 'Adventure', '16': 'Animation', '35': 'Comedy',
      '80': 'Crime', '99': 'Documentary', '18': 'Drama', '10751': 'Family',
      '14': 'Fantasy', '36': 'History', '27': 'Horror', '10402': 'Music',
      '9648': 'Mystery', '10749': 'Romance', '878': 'Sci-Fi', '10770': 'TV Movie',
      '53': 'Thriller', '10752': 'War', '37': 'Western'
    };

    // 0. Fetch Uploaded Videos by Category
    try {
      const genreName = genreMap[genreId.toString()];
      if (genreName) {
        // Find uploaded matching category name
        const uploads = await UploadedVideoModel.findAll({ category: genreName.toLowerCase(), page });
        results.push(...uploads.videos.map(v => this.formatUploadedVideo(v)));
      }
    } catch (e) {
      console.error('❌ Uploaded genre fetch error:', e.message);
    }

    // 1. Fetch from TMDB
    if (this.isConfigured()) {
      try {
        console.log(`🎬 TMDB: Fetching by genre ${genreId} (page: ${page})`);
        const res = await axios.get(`${TMDB_API_BASE}/discover/movie`, {
          params: {
            api_key: process.env.MOVIE_DATABASE,
            with_genres: genreId,
            page,
            sort_by: 'popularity.desc'
          }
        });
        const tmdbMovies = (res.data.results || []).map(m => this.formatMovie(m));
        results.push(...tmdbMovies);
      } catch (error) {
        console.error('❌ TMDB genre fetch error:', error.message);
      }
    }

    // 2. Fetch from OMDB (using keyword search for the genre)
    let omdbMovies = [];
    if (OmdbService.isConfigured()) {
      const genreName = genreMap[genreId.toString()];
      if (genreName) {
        try {
          const omdbRes = await OmdbService.search(genreName, { page });
          omdbMovies = omdbRes.videos;
        } catch (error) {
          console.error('❌ OMDB genre supplement error:', error.message);
        }
      }
    }

    const uploadedMovies = results.filter(v => v.platform === 'uploaded');
    const tmdbMovies = results.filter(v => v.platform === 'tmdb');
    const external = this.interleave(tmdbMovies, omdbMovies);
    return _.uniqBy(this.interleave(uploadedMovies, external), 'title');
  },

  // Get genre list
  async getGenres() {
    if (!this.isConfigured()) return [];

    try {
      const res = await axios.get(`${TMDB_API_BASE}/genre/movie/list`, {
        params: {
          api_key: process.env.MOVIE_DATABASE
        }
      });
      return res.data.genres || [];
    } catch (error) {
      console.error('❌ TMDB genres error:', error.message);
      return [];
    }
  },

  // Get movie details including cast, trailers, and similar movies
  async getDetails(movieId) {
    // Determine provider for local upload
    if (movieId.startsWith('upload_')) {
      try {
        const up = await UploadedVideoModel.findById(movieId);
        if (up) {
           const formatted = this.formatUploadedVideo(up);
           formatted.recommendations = [];
           formatted.cast = [];
           formatted.genres = [{ id: 0, name: up.category || 'general' }];
           formatted.status = 'Released';
           return formatted;
        }
      } catch (e) {
        console.error('❌ Upload details error:', e.message);
      }
      return null;
    }

    // Determine provider
    if (movieId.startsWith('omdb_')) {
      return await OmdbService.getDetails(movieId);
    }

    if (!this.isConfigured()) return null;

    try {
      // Remove tmdb_ prefix if present
      const id = movieId.startsWith('tmdb_') ? movieId.replace('tmdb_', '') : movieId;
      
      console.log(`🎬 TMDB: Fetching details for movie ${id}`);
      const res = await axios.get(`${TMDB_API_BASE}/movie/${id}`, {
        params: {
          api_key: process.env.MOVIE_DATABASE,
          append_to_response: 'videos,credits,similar'
        }
      });

      const data = res.data;
      
      // Extract trailer (first YouTube trailer)
      const trailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      
      // Extract top cast
      const cast = (data.credits?.cast || []).slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
      }));

      // Extract similar movies
      const similar = (data.similar?.results || []).slice(0, 8).map(m => this.formatMovie(m));

      return {
        ...this.formatMovie(data),
        tagline: data.tagline,
        runtime: data.runtime,
        genres: data.genres,
        backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
        cast,
        trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
        trailerKey: trailer?.key,
        recommendations: similar,
        status: data.status,
        budget: data.budget,
        revenue: data.revenue
      };
    } catch (error) {
      console.error('❌ TMDB details error:', error.message);
      // Fallback to OMDB if TMDB fails
      if (OmdbService.isConfigured()) {
        console.log('🔄 Attempting OMDB fallback for details...');
        return await OmdbService.getDetails(movieId);
      }
      return null;
    }
  },

  // Cache movies
  async cacheMovies(movies) {
    try {
      if (!movies.length) return;
      if (!isMongoConnected()) return;

      console.log(`💾 Caching ${movies.length} movies to MongoDB`);
      const ops = movies.map(v => ({
        updateOne: {
          filter: { videoId: v.videoId, platform: v.platform },
          update: { $set: { ...v, cachedAt: new Date() } },
          upsert: true
        }
      }));
      await Video.bulkWrite(ops);
    } catch (error) {
      console.error('❌ Movie cache error:', error.message);
    }
  }
};

export default MovieService;
