const express = require('express');
const {
  getActivePopup,
  getPopupImage
} = require('../controllers/websitePopupController');

const router = express.Router();

router.get('/active', getActivePopup);
router.get('/image', getPopupImage);

module.exports = router;
