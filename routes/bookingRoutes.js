const express = require('express');
const router = express.Router();
const {
  createBooking,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  getMyBookings,
  getOwnerBookings,
  getOwnerOccupancy,
  getBookingById,
  getAdminBookings,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Seeker Routes
router.post('/', protect, authorizeRoles('SEEKER'), createBooking);
router.get('/my', protect, authorizeRoles('SEEKER'), getMyBookings);

// Owner Routes
router.get('/owner', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerBookings);
router.get('/owner/occupancy', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerOccupancy);
router.patch('/:id/accept', protect, authorizeRoles('OWNER', 'ADMIN'), acceptBooking);
router.patch('/:id/reject', protect, authorizeRoles('OWNER', 'ADMIN'), rejectBooking);

// Shared Cancel & Single View Routes
router.patch('/:id/cancel', protect, cancelBooking);
router.get('/:id', protect, getBookingById);

// Admin Routes
router.get('/admin/all', protect, authorizeRoles('ADMIN'), getAdminBookings);

module.exports = router;
