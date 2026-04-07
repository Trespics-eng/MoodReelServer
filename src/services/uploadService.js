import { getSupabase, BUCKET_NAME } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import Video from '../models/mongo/Video.js';
import UploadedVideoModel from '../models/sql/UploadedVideo.js';

const UploadService = {
  // Upload video to Supabase Storage
  async uploadVideo(file, { userId, title, description, category, language = 'en' }) {
    const supabase = getSupabase();
    const videoId = `upload_${uuidv4()}`;
    
    let videoUrl = '';

    if (supabase && file) {
      // Upload to Supabase Storage
      const ext = file.originalname?.split('.').pop() || 'mp4';
      const filePath = `${userId}/${videoId}.${ext}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype || 'video/mp4',
          upsert: false
        });

      if (error) throw new Error(`Upload failed: ${error.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      videoUrl = urlData?.publicUrl || '';
    }

    // Save to uploaded_videos table (Supabase PostgreSQL)
    const uploadedVideo = await UploadedVideoModel.create({
      user_id: userId,
      video_id: videoId,
      title,
      description: description || '',
      category: category || 'general',
      video_url: videoUrl,
      language,
      status: 'active'
    });

    // Also cache in MongoDB for search
    try {
      await Video.create({
        videoId,
        title,
        description: description || '',
        platform: 'uploaded',
        category: category || 'general',
        uploadedBy: userId,
        videoUrl,
        language,
        source: 'upload',
        cachedAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Don't expire uploads
      });
    } catch (e) {
      console.error('MongoDB cache error for upload:', e.message);
    }

    return {
      videoId,
      videoUrl,
      ...uploadedVideo
    };
  },

  // Upload thumbnail
  async uploadThumbnail(file, videoId, userId) {
    const supabase = getSupabase();
    if (!supabase || !file) return '';

    const ext = file.originalname?.split('.').pop() || 'jpg';
    const filePath = `thumbnails/${userId}/${videoId}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Thumbnail upload error:', error.message);
      return '';
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData?.publicUrl || '';
  },

  // Upload character image
  async uploadCharacterImage(file, userId, characterId) {
    const supabase = getSupabase();
    if (!supabase || !file) return '';

    const ext = file.originalname?.split('.').pop() || 'jpg';
    const filePath = `characters/${userId}/${characterId}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Character image upload error:', error.message);
      return '';
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData?.publicUrl || '';
  },

  // Delete video from storage
  async deleteVideo(videoId, userId) {
    const supabase = getSupabase();

    // Remove from uploaded_videos table
    await UploadedVideoModel.delete(videoId);

    // Remove from MongoDB
    try {
      await Video.deleteOne({ videoId });
    } catch (e) {}

    // Remove from Supabase Storage
    if (supabase) {
      try {
        const { data: files } = await supabase.storage
          .from(BUCKET_NAME)
          .list(`${userId}/`, { search: videoId });

        if (files?.length) {
          const paths = files.map(f => `${userId}/${f.name}`);
          await supabase.storage.from(BUCKET_NAME).remove(paths);
        }
      } catch (e) {
        console.error('Storage cleanup error:', e.message);
      }
    }

    return true;
  },

  // Update video metadata
  async updateVideo(videoId, userId, { title, description, category, language }) {
    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (category) updates.category = category;
    if (language) updates.language = language;

    // Update SQL (uploaded_videos)
    const updated = await UploadedVideoModel.update(videoId, updates);
    if (!updated) throw new Error('Video not found or access denied');

    // Sync with MongoDB
    try {
      await Video.updateOne({ videoId }, { $set: updates });
    } catch (e) {
      console.error('MongoDB sync error on update:', e.message);
    }

    return updated;
  }
};

export default UploadService;
