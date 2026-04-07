import UserSettingsModel from '../models/sql/UserSettings.js';

const settingsController = {
  // GET /api/settings
  async getSettings(req, res) {
    try {
      console.log(`⚙️ Fetching settings for User ${req.user.id}`);
      const settings = await UserSettingsModel.findByUser(req.user.id);
      
      console.log(`✅ Settings loaded for User ${req.user.id}`);
      res.json({ 
        message: 'Settings fetched successfully',
        settings 
      });
    } catch (error) {
      console.error('❌ getSettings error:', error.message);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  },

  // PUT /api/settings
  async updateSettings(req, res) {
    try {
      const { theme, language, default_pixel, notifications_enabled, autoplay } = req.body;
      const updates = {};
      
      console.log(`⚙️ Updating preferences for User ${req.user.id}`);

      if (theme) updates.theme = theme;
      if (language) updates.language = language;
      if (default_pixel) updates.default_pixel = default_pixel;
      if (typeof notifications_enabled === 'boolean') updates.notifications_enabled = notifications_enabled;
      if (typeof autoplay === 'boolean') updates.autoplay = autoplay;

      const settings = await UserSettingsModel.update(req.user.id, updates);
      
      console.log(`✅ Settings updated for User ${req.user.id}`);
      res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
      console.error('❌ updateSettings error:', error.message);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
};

export default settingsController;
