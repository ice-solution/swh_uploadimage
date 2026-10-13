const fs = require('fs');
const path = require('path');
const Upload = require('../models/Upload');
const { UPLOAD_DIR, ensureUploadDir } = require('../config/paths');

/**
 * 刪除已過期的磁碟檔案（MongoDB TTL 只清 DB，不清 filesystem）
 */
async function cleanupExpiredFiles() {
  ensureUploadDir();

  const expired = await Upload.find({ expiresAt: { $lte: new Date() } }).lean();
  for (const item of expired) {
    for (const name of [item.imageFilename, item.qrcodeFilename]) {
      if (!name) continue;
      const filePath = path.join(UPLOAD_DIR, name);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete ${filePath}:`, err.message);
        }
      }
    }
  }

  // 清掉 uploads 目錄中已無 DB 記錄的孤立檔案
  const active = await Upload.find({ expiresAt: { $gt: new Date() } })
    .select('imageFilename qrcodeFilename')
    .lean();
  const keep = new Set(
    active.flatMap((item) => [item.imageFilename, item.qrcodeFilename].filter(Boolean))
  );

  const files = fs.readdirSync(UPLOAD_DIR);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    if (!keep.has(file)) {
      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        // 給剛上傳、尚未寫入 DB 的檔案一點緩衝（5 分鐘）
        if (Date.now() - stat.mtimeMs > 5 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Failed to delete orphan ${filePath}:`, err.message);
      }
    }
  }
}

function startCleanupJob(intervalMs = 10 * 60 * 1000) {
  ensureUploadDir();
  cleanupExpiredFiles().catch((err) => console.error('Cleanup error:', err.message));
  setInterval(() => {
    cleanupExpiredFiles().catch((err) => console.error('Cleanup error:', err.message));
  }, intervalMs);
  console.log(`Cleanup job started (every ${intervalMs / 1000}s)`);
}

module.exports = { cleanupExpiredFiles, startCleanupJob };
