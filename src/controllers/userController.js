import bcrypt from 'bcrypt';
import UserModel from '../models/sql/User.js';
import SavedVideoModel from '../models/sql/SavedVideo.js';
import UserSettingsModel from '../models/sql/UserSettings.js';
import UploadedVideoModel from '../models/sql/UploadedVideo.js';
import { generateToken } from '../middleware/auth.js';
import { getSupabase, BUCKET_NAME } from '../config/supabase.js';

const SALT_ROUNDS = 12;

const userController = {
  // POST /api/users/signup
  async signup(req, res) {
    try {
      const { email, username, password } = req.body;
      console.log(`👤 New signup attempt: email=${email}, username=${username}`);

      if (!email || !username || !password) {
        console.warn('⚠️ Signup failed: Missing required fields');
        return res.status(400).json({ error: 'Email, username, and password are required' });
      }

      if (password.length < 6) {
        console.warn('⚠️ Signup failed: Password too short');
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user exists
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        console.warn(`⚠️ Signup failed: Email ${email} already registered`);
        return res.status(409).json({ error: 'Email already registered' });
      }

      const existingUsername = await UserModel.findByUsername(username);
      if (existingUsername) {
        console.warn(`⚠️ Signup failed: Username ${username} already taken`);
        return res.status(409).json({ error: 'Username already taken' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = await UserModel.create({ email, passwordHash, username });

      // Create default settings
      await UserSettingsModel.create(user.id);

      // Generate token
      const token = generateToken(user);

      console.log(`✅ Account created successfully: ${user.id} (${username})`);
      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile_pic: user.profile_pic,
          role: user.role
        }
      });
    } catch (error) {
      console.error('❌ Signup error:', error.message);
      res.status(500).json({ error: 'Failed to create account' });
    }
  },

  // POST /api/users/login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      console.log(`🔑 Login attempt: ${email}`);

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        console.warn(`⚠️ Login failed: User not found [${email}]`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.is_active) {
        console.warn(`⚠️ Login failed: Account deactivated [${email}]`);
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        console.warn(`⚠️ Login failed: Wrong password [${email}]`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = generateToken(user);

      console.log(`✅ Login successful: ${user.id} (${user.username})`);
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile_pic: user.profile_pic,
          role: user.role
        }
      });
    } catch (error) {
      console.error('❌ Login error:', error.message);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  // GET /api/users/profile
  async getProfile(req, res) {
    try {
      console.log(`👤 Fetching profile for User ${req.user.id}`);
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const uploads = await UploadedVideoModel.findByUser(user.id);
      const saved = await SavedVideoModel.findByUser(user.id);

      console.log(`✅ Profile loaded for ${user.username}: ${uploads.length} uploads, ${saved.length} saved`);
      res.json({
        message: 'Profile fetched successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile_pic: user.profile_pic,
          role: user.role,
          created_at: user.created_at
        },
        uploads,
        savedVideos: saved
      });
    } catch (error) {
      console.error('❌ getProfile error:', error.message);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  },

  // PUT /api/users/profile
  async updateProfile(req, res) {
    try {
      const { username, email } = req.body;
      const updates = {};
      console.log(`📝 Updating profile for User ${req.user.id}`);

      if (username) {
        const existing = await UserModel.findByUsername(username);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'Username already taken' });
        }
        updates.username = username;
      }

      if (email) {
        const existing = await UserModel.findByEmail(email);
        if (existing && existing.id !== req.user.id) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        updates.email = email;
      }

      // Handle profile pic upload
      if (req.file) {
        console.log(`🖼️ Uploading new profile picture for User ${req.user.id}`);
        const supabase = getSupabase();
        if (supabase) {
          const ext = req.file.originalname?.split('.').pop() || 'jpg';
          const filePath = `profile-pics/${req.user.id}.${ext}`;
          
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, req.file.buffer, {
              contentType: req.file.mimetype,
              upsert: true
            });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(filePath);
            updates.profile_pic = urlData?.publicUrl || '';
            console.log('✅ Profile picture uploaded to Supabase');
          } else {
            console.error('❌ Supabase storage error:', error.message);
          }
        }
      }

      const user = await UserModel.update(req.user.id, updates);

      console.log(`✅ Profile updated for User ${req.user.id}`);
      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile_pic: user.profile_pic,
          role: user.role
        }
      });
    } catch (error) {
      console.error('❌ updateProfile error:', error.message);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  },

  // POST /api/users/save-video
  async saveVideo(req, res) {
    try {
      const { videoId, platform } = req.body;
      if (!videoId) return res.status(400).json({ error: 'Video ID required' });

      console.log(`⭐ Saving video ${videoId} [${platform}] for User ${req.user.id}`);
      await SavedVideoModel.save(req.user.id, videoId, platform);
      
      console.log(`✅ Video ${videoId} saved`);
      res.json({ message: 'Video saved successfully', saved: true });
    } catch (error) {
      console.error('❌ saveVideo error:', error.message);
      res.status(500).json({ error: 'Failed to save video' });
    }
  },

  // DELETE /api/users/save-video/:videoId
  async unsaveVideo(req, res) {
    try {
      console.log(`⭐ Unsaving video ${req.params.videoId} for User ${req.user.id}`);
      await SavedVideoModel.unsave(req.user.id, req.params.videoId);
      
      console.log(`✅ Video ${req.params.videoId} unsaved`);
      res.json({ message: 'Video removed from saved', saved: false });
    } catch (error) {
      console.error('❌ unsaveVideo error:', error.message);
      res.status(500).json({ error: 'Failed to remove saved video' });
    }
  },

  // GET /api/users/saved-videos
  async getSavedVideos(req, res) {
    try {
      console.log(`⭐ Fetching saved videos for User ${req.user.id}`);
      const saved = await SavedVideoModel.findByUser(req.user.id);
      
      console.log(`✅ Returned ${saved.length} saved videos`);
      res.json({ message: 'Saved videos fetched successfully', savedVideos: saved });
    } catch (error) {
      console.error('❌ getSavedVideos error:', error.message);
      res.status(500).json({ error: 'Failed to fetch saved videos' });
    }
  },

  // GET /api/users/is-saved/:videoId
  async isSaved(req, res) {
    try {
      const saved = await SavedVideoModel.isSaved(req.user.id, req.params.videoId);
      res.json({ saved });
    } catch (error) {
      res.json({ saved: false });
    }
  },

  // GET /api/users/favourites
  async getFavourites(req, res) {
    try {
      console.log(`⭐ Fetching favourites for User ${req.user.id}`);
      const ActivityLog = (await import('../models/mongo/ActivityLog.js')).default;
      const VideoService = (await import('../services/videoService.js')).default;

      // Find top videos by frequency of watch/like/save
      const topVideos = await ActivityLog.aggregate([
        { $match: { userId: req.user.id.toString(), action: { $in: ['watch', 'like', 'save'] }, videoId: { $ne: null } } },
        { $group: { _id: '$videoId', count: { $sum: 1 }, platform: { $first: '$platform' } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);

      const videoPromises = topVideos.map(async (v) => {
        try {
          return await VideoService.getById(v._id);
        } catch { return null; }
      });

      const videos = (await Promise.all(videoPromises)).filter(Boolean);

      console.log(`✅ Returned ${videos.length} favourite videos`);
      res.json({ message: 'Favourites fetched successfully', videos });
    } catch (error) {
      console.error('❌ getFavourites error:', error.message);
      res.status(500).json({ error: 'Failed to fetch favourites' });
    }
  }
};

export default userController;
