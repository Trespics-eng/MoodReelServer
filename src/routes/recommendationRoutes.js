import { Router } from 'express';
import recommendationController from '../controllers/recommendationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, recommendationController.getRecommendations);
router.post('/activity', authenticate, recommendationController.logActivity);

export default router;
