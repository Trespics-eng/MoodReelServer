import express from 'express';
import creationController from '../controllers/creationController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';

const router = express.Router();

// GET /api/creation/characters (optionalAuth lets public characters be matched without throwing 401)
router.get('/characters', optionalAuth, creationController.getAvailableCharacters);

// All subsequent creation routes strictly require full authentication
router.use(authenticate);

// POST /api/creation/save
router.post('/save', creationController.saveProgress);

// GET /api/creation/progress
router.get('/progress', creationController.getLatestProgress);

// POST /api/creation/characters
router.post('/characters', imageUpload.single('image'), creationController.createCharacter);

// DELETE /api/creation/progress/:id
router.delete('/progress/:id', creationController.clearProgress);

export default router;
