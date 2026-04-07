import CreationProgressModel from '../models/sql/CreationProgress.js';
import CharacterLibraryModel from '../models/sql/CharacterLibrary.js';
import CharacterModel from '../models/sql/Character.js';
import UploadService from '../services/uploadService.js';
import { v4 as uuidv4 } from 'uuid';

const creationController = {
  // POST /api/creation/save
  async saveProgress(req, res) {
    try {
      const { type, title, data, step } = req.body;
      const userId = req.user.id;

      console.log(`🎬 Saving creation progress for user ${userId} at step ${step}`);
      
      const progress = await CreationProgressModel.save({
        userId,
        type,
        title: title || 'Untitled Production',
        data,
        step
      });

      res.status(200).json({
        message: 'Progress saved successfully',
        progress
      });
    } catch (error) {
      console.error('❌ Error saving progress:', error.message);
      res.status(500).json({ error: 'Failed to save progress' });
    }
  },

  // GET /api/creation/progress
  async getLatestProgress(req, res) {
    try {
      const userId = req.user.id;
      console.log(`🎬 Fetching latest progress for user ${userId}`);
      
      const progress = await CreationProgressModel.findLatestByUserId(userId);
      
      res.status(200).json({
        message: 'Latest progress fetched',
        progress
      });
    } catch (error) {
      console.error('❌ Error fetching progress:', error.message);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  },

  // GET /api/creation/characters
  async getAvailableCharacters(req, res) {
    try {
      console.log('🎭 Fetching available characters library');
      const userId = req.user?.id;
      const characters = await CharacterLibraryModel.getAll(userId);
      
      res.status(200).json({
        message: 'Characters fetched successfully',
        characters
      });
    } catch (error) {
      console.error('❌ Error fetching characters:', error.message);
      res.status(500).json({ error: 'Failed to fetch characters' });
    }
  },

  // POST /api/creation/characters
  async createCharacter(req, res) {
    try {
      const { name, role, personality, traits, is_public } = req.body;
      const userId = req.user.id;
      
      let imageUrl = null;
      let characterId = uuidv4();

      if (req.file) {
        imageUrl = await UploadService.uploadCharacterImage(req.file, userId, characterId);
      }

      const characterData = {
        id: characterId,
        user_id: userId,
        name,
        role,
        personality,
        traits: traits ? traits.split(',').map(t => t.trim()) : [],
        image_url: imageUrl,
        is_public: is_public === 'true'
      };

      const character = await CharacterModel.create(characterData);
      
      // format to match the preset structure requested by frontend if needed
      const formatted = {
        id: character.id,
        name: character.name,
        personality: character.personality,
        role: character.role,
        image_url: character.image_url,
        characteristics: character.traits ? character.traits.join(', ') : '',
        is_public: character.is_public
      };

      res.status(201).json({
        message: 'Character created successfully',
        character: formatted
      });
    } catch (error) {
      console.error('❌ Error creating character:', error.message);
      res.status(500).json({ error: 'Failed to create character' });
    }
  },

  // DELETE /api/creation/progress/:id
  async clearProgress(req, res) {
    try {
      const { id } = req.params;
      console.log(`🎬 Clearing progress ${id}`);
      await CreationProgressModel.delete(id);
      res.status(200).json({ message: 'Progress cleared' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear progress' });
    }
  }
};

export default creationController;
