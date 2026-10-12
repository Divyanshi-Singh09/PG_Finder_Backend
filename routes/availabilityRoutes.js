const express = require('express');
const router = express.Router();
const {
  createSlot,
  getMyAvailability,
  updateSlot,
  deleteSlot,
} = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Owner Availability Routes
router.post('/', protect, authorizeRoles('OWNER', 'ADMIN'), createSlot);
router.get('/my', protect, authorizeRoles('OWNER', 'ADMIN'), getMyAvailability);
router.patch('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), updateSlot);
router.delete('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), deleteSlot);

module.exports = router;
