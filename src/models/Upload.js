const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    imageFilename: {
      type: String,
      required: true,
    },
    qrcodeFilename: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    qrcodeUrl: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// MongoDB TTL：到 expiresAt 後自動刪除文件記錄
uploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Upload', uploadSchema);
