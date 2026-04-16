// Forced restart to pick up CORS changes
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import connectMongoDB from './src/config/database.js';
import initSupabase from './src/config/supabase.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';

import videoRoutes from './src/routes/videoRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import recommendationRoutes from './src/routes/recommendationRoutes.js';
import settingsRoutes from './src/routes/settingsRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import movieRoutes from './src/routes/movieRoutes.js';
import creationRoutes from './src/routes/creationRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/videos', videoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/creation', creationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'BidLan API'
  });
});

// ─── Error Handling ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Start Server ──────────────────────────────────────────────
const start = async () => {
  console.log('🎬 BidLan API Server starting...\n');

  // Initialize Supabase (for DB + Storage)
  initSupabase();

  // Connect MongoDB (for caching)
  await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
  });
};

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
