/**
 * AI Proxy Routes — Express.js integration with FastAPI AI server.
 * All /api/ai/* requests are proxied to the Python AI backend.
 */

import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';

const router = express.Router();

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

// Multer for handling file uploads before proxying
const upload = multer({
  dest: '/tmp/ai-uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

/**
 * Generic proxy helper — forwards requests to FastAPI
 */
async function proxyToAI(endpoint, data = {}, files = [], timeout = 120000) {
  const url = `${AI_SERVER_URL}/api/ai${endpoint}`;

  try {
    if (files.length > 0) {
      // Multipart form data with files
      const form = new FormData();

      for (const file of files) {
        form.append('file', fs.createReadStream(file.path), {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }

      // Append other form fields
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          form.append(key, String(value));
        }
      }

      const response = await axios.post(url, form, {
        headers: { ...form.getHeaders() },
        timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Cleanup temp files
      for (const file of files) {
        fs.unlink(file.path, () => {});
      }

      return response.data;
    } else {
      // JSON request
      const response = await axios.post(url, data, { timeout });
      return response.data;
    }
  } catch (error) {
    // Cleanup on error
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }

    if (error.response) {
      throw { status: error.response.status, message: error.response.data?.detail || 'AI processing failed' };
    }
    throw { status: 503, message: 'AI server unavailable' };
  }
}

// ─── Health ─────────────────────────────────────────────────

router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVER_URL}/health`, { timeout: 3000 });
    res.json(response.data);
  } catch (error) {
    // Graceful fallback to avoid 503 red console errors
    res.json({ status: 'unavailable', error: 'AI server is not responding', offline: true });
  }
});

router.get('/status', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVER_URL}/api/ai/status`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    // Graceful fallback to avoid 503 red console errors
    res.json({ status: 'unavailable', error: 'AI server is not responding', offline: true });
  }
});

// ─── Video Analysis ─────────────────────────────────────────

router.post('/analyze/video', upload.single('file'), async (req, res) => {
  try {
    const files = req.file ? [req.file] : [];
    const result = await proxyToAI('/analyze/video', {
      url: req.body.url,
      extract_audio: req.body.extract_audio ?? 'true',
      transcribe: req.body.transcribe ?? 'true',
      detect_objects: req.body.detect_objects ?? 'true',
      generate_summary: req.body.generate_summary ?? 'true',
      generate_metadata: req.body.generate_metadata ?? 'true',
    }, files);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Transcription ──────────────────────────────────────────

router.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    const files = req.file ? [req.file] : [];
    const result = await proxyToAI('/transcribe', {
      url: req.body.url,
      language: req.body.language,
      model_size: req.body.model_size || 'base',
    }, files);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Translation ────────────────────────────────────────────

router.post('/translate', async (req, res) => {
  try {
    const result = await proxyToAI('/translate', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Summarization ──────────────────────────────────────────

router.post('/summarize', async (req, res) => {
  try {
    const result = await proxyToAI('/summarize', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Sentiment ──────────────────────────────────────────────

router.post('/sentiment', async (req, res) => {
  try {
    const result = await proxyToAI('/sentiment', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Content Automation ─────────────────────────────────────

router.post('/auto-content', async (req, res) => {
  try {
    const result = await proxyToAI('/auto-content', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Video Enhancement ─────────────────────────────────────

router.post('/enhance/video', upload.single('file'), async (req, res) => {
  try {
    const files = req.file ? [req.file] : [];
    const result = await proxyToAI('/enhance/video', {
      url: req.body.url,
      denoise: req.body.denoise ?? 'true',
      upscale: req.body.upscale ?? 'false',
      stabilize: req.body.stabilize ?? 'false',
      audio_enhance: req.body.audio_enhance ?? 'true',
      add_subtitles: req.body.add_subtitles ?? 'false',
      subtitle_language: req.body.subtitle_language || 'en',
    }, files);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Video Generation ───────────────────────────────────────

router.post('/generate/video', async (req, res) => {
  try {
    const result = await proxyToAI('/generate/video', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Job Status ─────────────────────────────────────────────

router.get('/job/:jobId', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVER_URL}/api/ai/job/${req.params.jobId}`, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Failed to get job status' });
  }
});

// ─── Chat ───────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  try {
    const result = await proxyToAI('/chat', req.body);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─── Multimodal ─────────────────────────────────────────────

router.post('/multimodal', upload.single('file'), async (req, res) => {
  try {
    const files = req.file ? [req.file] : [];
    const result = await proxyToAI('/multimodal', {
      prompt: req.body.prompt || 'Describe this content',
      input_type: req.body.input_type || 'text',
      output_type: req.body.output_type || 'text',
    }, files);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
