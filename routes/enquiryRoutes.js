const express = require('express');
const router = express.Router();
const {
  createEnquiry,
  getMyEnquiries,
  getEnquiryById,
  closeEnquiry,
  getOwnerEnquiries,
  respondToEnquiry,
} = require('../controllers/enquiryController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Seeker Enquiry Routes
router.post('/', protect, authorizeRoles('SEEKER'), createEnquiry);
router.get('/my', protect, authorizeRoles('SEEKER'), getMyEnquiries);

// Owner Enquiry Routes
router.get('/owner/all', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerEnquiries);
router.patch('/owner/:id/respond', protect, authorizeRoles('OWNER', 'ADMIN'), respondToEnquiry);

// General Enquiry Routes (Seeker, Owner, Admin)
router.get('/:id', protect, getEnquiryById);
router.patch('/:id/close', protect, closeEnquiry);

module.exports = router;
