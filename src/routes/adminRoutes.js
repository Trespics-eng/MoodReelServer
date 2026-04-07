import { Router } from 'express';
import adminController from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/unban', adminController.unbanUser);
router.get('/videos', adminController.getVideos);
router.delete('/videos/:id', adminController.deleteVideo);
router.get('/activity', adminController.getActivity);

// Character Management Routes
router.get('/characters', adminController.getCharacters);
router.post('/characters', adminController.createCharacter);
router.put('/characters/:id', adminController.updateCharacter);
router.delete('/characters/:id', adminController.deleteCharacter);
export default router;
