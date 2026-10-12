const express = require('express');
const router = express.Router();
const {
  saveFavorite,
  removeFavorite,
  getFavorites,
  getFavoriteStatus,
} = require('../controllers/favoriteController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Favorites APIs (Require Authentication + SEEKER role)
router.use(protect, authorizeRoles('SEEKER'));

router.get('/', getFavorites);
router.post('/:pgId', saveFavorite);
router.delete('/:pgId', removeFavorite);
router.get('/:pgId/status', getFavoriteStatus);

module.exports = router;
