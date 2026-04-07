import { Router } from 'express';
import settingsController from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, settingsController.updateSettings);

export default router;
