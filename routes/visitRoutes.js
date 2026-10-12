const express = require('express');
const router = express.Router();
const {
  requestVisit,
  getMyVisits,
  getOwnerVisits,
  getVisitById,
  confirmVisit,
  rejectVisit,
  cancelVisit,
  updateVisitStatus,
  getAdminVisits,
} = require('../controllers/visitController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Seeker Visit Routes
router.post('/', protect, authorizeRoles('SEEKER'), requestVisit);
router.get('/my', protect, authorizeRoles('SEEKER'), getMyVisits);

// Owner Visit Routes
router.get('/owner/all', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerVisits);
router.patch('/:id/confirm', protect, authorizeRoles('OWNER', 'ADMIN'), confirmVisit);
router.patch('/:id/reject', protect, authorizeRoles('OWNER', 'ADMIN'), rejectVisit);
router.patch('/:id/status', protect, authorizeRoles('OWNER', 'ADMIN'), updateVisitStatus);

// Admin Visit Routes
router.get('/admin/all', protect, authorizeRoles('ADMIN'), getAdminVisits);

// General Visit Routes
router.get('/:id', protect, getVisitById);
router.patch('/:id/cancel', protect, cancelVisit);

module.exports = router;
