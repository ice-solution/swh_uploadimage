require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const connectDB = require('./config/db');
const { ensureUploadDir, UPLOAD_DIR } = require('./config/paths');
const { startCleanupJob } = require('./utils/cleanup');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const themeRoutes = require('./routes/theme');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// Behind Apache + Cloudflare Flexible (X-Forwarded-Proto=https)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureUploadDir();
app.use('/files', express.static(UPLOAD_DIR, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=7200');
  },
}));

app.use('/admin', express.static(path.join(PUBLIC_DIR, 'admin'), {
  index: 'index.html',
}));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/theme', themeRoutes);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err);
  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

async function start() {
  await connectDB();
  startCleanupJob();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
