const express = require('express');
const router = express.Router();
const {
  searchPGs,
  getPGAutocomplete,
  getPGRecommendations,
  getSimilarPGsController,
  getPublicPGById,
  createPG,
  getMyPGs,
  getPGById,
  updatePG,
  deletePG,
  submitPG,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
} = require('../controllers/pgController');
const { getPublicPGAvailability } = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Public Seeker Discovery & Availability Routes
router.get('/search', searchPGs);
router.get('/autocomplete', getPGAutocomplete);
router.get('/recommendations', getPGRecommendations);
router.get('/:id/similar', getSimilarPGsController);
router.get('/public/:id', getPublicPGById);
router.get('/:pgId/availability', getPublicPGAvailability);

// Seeker Saved Searches
router.post('/saved-searches', protect, authorizeRoles('SEEKER'), saveSearch);
router.get('/saved-searches', protect, authorizeRoles('SEEKER'), getSavedSearches);
router.delete('/saved-searches/:id', protect, authorizeRoles('SEEKER'), deleteSavedSearch);

// Owner PG Management Routes (Protected)
router.post('/', protect, authorizeRoles('OWNER', 'ADMIN'), createPG);
router.get('/my', protect, authorizeRoles('OWNER', 'ADMIN'), getMyPGs);
router.get('/:id', protect, getPGById);
router.put('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), updatePG);
router.delete('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), deletePG);
router.patch('/:id/submit', protect, authorizeRoles('OWNER', 'ADMIN'), submitPG);

module.exports = router;
