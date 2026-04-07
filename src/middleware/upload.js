import multer from 'multer';

// Use memory storage for Supabase upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Video files
  const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
  // Image files (for thumbnails, profile pics)
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if ([...videoTypes, ...imageTypes].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: MP4, WebM, OGG, MOV, AVI, JPEG, PNG, WebP, GIF'), false);
  }
};

// Video upload config (max 500MB)
export const videoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

// Image upload config (max 10MB) for thumbnails & profile pics
export const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Allowed: JPEG, PNG, WebP, GIF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
