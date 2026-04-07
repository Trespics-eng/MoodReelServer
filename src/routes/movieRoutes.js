import express from 'express';
import MovieService from '../services/movieService.js';

const router = express.Router();

// GET /api/movies/trending
router.get('/trending', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const movies = await MovieService.getTrending({ page });
    
    if (movies.length) {
      // Cache movies asynchronously
      MovieService.cacheMovies(movies).catch(() => {});
    }
    
    res.json({ success: true, videos: movies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/movies/genres
router.get('/genres', async (req, res) => {
  try {
    const genres = await MovieService.getGenres();
    res.json({ success: true, genres });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/movies/category/:genreId
router.get('/category/:genreId', async (req, res) => {
  try {
    const genreId = req.params.genreId;
    const page = parseInt(req.query.page) || 1;
    const movies = await MovieService.getByGenre(genreId, { page });
    
    if (movies.length) {
      MovieService.cacheMovies(movies).catch(() => {});
    }
    
    res.json({ success: true, videos: movies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/movies/search
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const result = await MovieService.search(query, { page });
    
    if (result.videos.length) {
      MovieService.cacheMovies(result.videos).catch(() => {});
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/movies/:id
router.get('/:id', async (req, res) => {
  try {
    const movie = await MovieService.getDetails(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.json({ success: true, movie });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
