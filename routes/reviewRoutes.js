const express = require('express');
const router = express.Router();
const {
  createReview,
  getPGReviews,
  getReviewEligibility,
  toggleHelpful,
  replyToReview,
  getOwnerReviews,
  getAdminReviews,
  moderateReviewStatus,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Seeker Review Routes
router.post('/', protect, authorizeRoles('SEEKER'), createReview);
router.get('/eligibility/:bookingId', protect, authorizeRoles('SEEKER'), getReviewEligibility);
router.post('/:id/helpful', protect, toggleHelpful);

// Public PG Reviews Listing
router.get('/pg/:pgId', getPGReviews);

// Owner Reply & Reviews Routes
router.patch('/:id/reply', protect, authorizeRoles('OWNER', 'ADMIN'), replyToReview);
router.get('/owner', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerReviews);

// Admin Moderation Routes
router.get('/admin/all', protect, authorizeRoles('ADMIN'), getAdminReviews);
router.patch('/admin/:id/status', protect, authorizeRoles('ADMIN'), moderateReviewStatus);

module.exports = router;
