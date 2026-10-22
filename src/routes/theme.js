const express = require('express');
const themeController = require('../controllers/themeController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 公開：依日期查當前 phase
router.get('/current', themeController.getCurrentTheme);
router.get('/', themeController.listThemes);
router.get('/:id', themeController.getThemeById);

// 需登入：管理 theme 區間
router.post('/', requireAuth, themeController.createTheme);
router.put('/:id', requireAuth, themeController.updateTheme);
router.delete('/:id', requireAuth, themeController.deleteTheme);

module.exports = router;
