import { Router } from 'express';
import videoController from '../controllers/videoController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { videoUpload } from '../middleware/upload.js';
import { searchLimiter, uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public routes
router.get('/', searchLimiter, optionalAuth, videoController.getVideos);
router.get('/homepage', optionalAuth, videoController.getHomepage);
router.get('/most-watched', videoController.getMostWatched);
router.get('/categories', videoController.getCategories);
router.get('/category/:category', videoController.getByCategory);
router.get('/suggestions', videoController.getSuggestions);
router.get('/:id', optionalAuth, videoController.getById);

// Protected routes
router.post('/upload', authenticate, uploadLimiter, videoUpload.single('video'), videoController.upload);
router.put('/:id', authenticate, videoController.updateVideo);
router.delete('/:id', authenticate, videoController.deleteVideo);

export default router;
