const express = require('express');
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/', requireAuth, upload.single('image'), uploadController.uploadImage);
router.get('/:id', requireAuth, uploadController.getUpload);

module.exports = router;
