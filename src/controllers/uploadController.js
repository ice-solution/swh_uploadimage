const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const Upload = require('../models/Upload');
const { UPLOAD_DIR, ensureUploadDir } = require('../config/paths');

function getTtlHours() {
  const hours = Number(process.env.UPLOAD_TTL_HOURS || 2);
  return Number.isFinite(hours) && hours > 0 ? hours : 2;
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'image file is required (field name: image)',
      });
    }

    ensureUploadDir();

    const id = uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const imageFilename = `${id}${ext}`;
    const qrcodeFilename = `${id}-qr.png`;
    const imagePath = path.join(UPLOAD_DIR, imageFilename);
    const qrcodePath = path.join(UPLOAD_DIR, qrcodeFilename);

    fs.renameSync(req.file.path, imagePath);

    const baseUrl = getBaseUrl(req);
    const imageUrl = `${baseUrl}/files/${imageFilename}`;
    const qrcodeUrl = `${baseUrl}/files/${qrcodeFilename}`;

    await QRCode.toFile(qrcodePath, imageUrl, {
      type: 'png',
      width: 400,
      margin: 2,
    });

    const ttlHours = getTtlHours();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const record = await Upload.create({
      user: req.user._id,
      imageFilename,
      qrcodeFilename,
      imageUrl,
      qrcodeUrl,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: record._id,
        imageUrl: record.imageUrl,
        qrcodeUrl: record.qrcodeUrl,
        expiresAt: record.expiresAt,
        ttlHours,
      },
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return next(err);
  }
}

function serializeUpload(record) {
  const now = Date.now();
  const expiresAtMs = record.expiresAt.getTime();
  return {
    id: record._id,
    imageUrl: record.imageUrl,
    qrcodeUrl: record.qrcodeUrl,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    user: record.user
      ? {
          id: record.user._id || record.user,
          username: record.user.username || null,
        }
      : null,
    expired: expiresAtMs <= now,
    remainingMs: Math.max(0, expiresAtMs - now),
  };
}

async function listUploads(req, res, next) {
  try {
    const includeExpired = String(req.query.includeExpired || '') === '1';
    const filter = includeExpired ? {} : { expiresAt: { $gt: new Date() } };

    const records = await Upload.find(filter)
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({
      success: true,
      data: records.map(serializeUpload),
    });
  } catch (err) {
    return next(err);
  }
}

async function getUpload(req, res, next) {
  try {
    const record = await Upload.findById(req.params.id).populate('user', 'username');
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Upload not found or expired',
      });
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({
        success: false,
        message: 'Upload has expired',
      });
    }

    return res.json({
      success: true,
      data: serializeUpload(record),
    });
  } catch (err) {
    return next(err);
  }
}

function unlinkQuiet(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete ${filePath}:`, err.message);
    }
  }
}

async function deleteUpload(req, res, next) {
  try {
    const record = await Upload.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Upload not found',
      });
    }

    unlinkQuiet(path.join(UPLOAD_DIR, record.imageFilename));
    unlinkQuiet(path.join(UPLOAD_DIR, record.qrcodeFilename));
    await record.deleteOne();

    return res.json({
      success: true,
      message: 'Upload deleted',
      data: { id: record._id },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  uploadImage,
  listUploads,
  getUpload,
  deleteUpload,
};
