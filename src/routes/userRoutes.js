import { Router } from 'express';
import userController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { imageUpload } from '../middleware/upload.js';

const router = Router();

// Public routes
router.post('/signup', authLimiter, userController.signup);
router.post('/login', authLimiter, userController.login);

// Protected routes
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, imageUpload.single('profilePic'), userController.updateProfile);
router.post('/save-video', authenticate, userController.saveVideo);
router.delete('/save-video/:videoId', authenticate, userController.unsaveVideo);
router.get('/saved-videos', authenticate, userController.getSavedVideos);
router.get('/is-saved/:videoId', authenticate, userController.isSaved);
router.get('/favourites', authenticate, userController.getFavourites);

export default router;
