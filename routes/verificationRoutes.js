const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  submitVerification,
  getVerificationStatus,
  getPrivateDocument,
  getAdminOwnerVerifications,
  approveOwnerVerification,
  rejectOwnerVerification,
  suspendPG,
  unsuspendPG,
} = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Owner Verification Routes
router.post('/owner/upload', protect, authorizeRoles('OWNER', 'ADMIN'), uploadDocument);
router.post('/owner/submit', protect, authorizeRoles('OWNER', 'ADMIN'), submitVerification);
router.get('/owner/status', protect, authorizeRoles('OWNER', 'ADMIN'), getVerificationStatus);
router.get('/document/:id', protect, getPrivateDocument);

// Admin Moderation Verification Routes
router.get('/admin/owner-verifications', protect, authorizeRoles('ADMIN'), getAdminOwnerVerifications);
router.patch('/admin/owner-verifications/:id/approve', protect, authorizeRoles('ADMIN'), approveOwnerVerification);
router.patch('/admin/owner-verifications/:id/reject', protect, authorizeRoles('ADMIN'), rejectOwnerVerification);
router.patch('/admin/pgs/:id/suspend', protect, authorizeRoles('ADMIN'), suspendPG);
router.patch('/admin/pgs/:id/unsuspend', protect, authorizeRoles('ADMIN'), unsuspendPG);

module.exports = router;
