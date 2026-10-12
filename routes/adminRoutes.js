const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getPGs,
  getPGDetailsForReview,
  approvePG,
  rejectPG,
  suspendPG,
  reactivatePG,
  getUsers,
  getUserById,
  updateUserStatus,
  createComplaint,
  getAdminComplaints,
  updateComplaintStatus,
  getPlatformAnalytics,
  getActivityLogs,
  getPlatformSettings,
  updatePlatformSettings,
  globalAdminSearch,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// All admin routes protected for ADMIN role
router.use(protect);

// Seeker/Owner can post complaint to /api/admin/complaints (public complaint submission)
router.post('/complaints', createComplaint);

// Admin-Only Routes
router.use(authorizeRoles('ADMIN'));

router.get('/search', globalAdminSearch);
router.get('/stats', getDashboardStats);
router.get('/pgs', getPGs);
router.get('/pgs/:id', getPGDetailsForReview);
router.patch('/pgs/:id/approve', approvePG);
router.patch('/pgs/:id/reject', rejectPG);
router.patch('/pgs/:id/suspend', suspendPG);
router.patch('/pgs/:id/reactivate', reactivatePG);

// User Management Routes
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);

// Complaints Management Routes
router.get('/complaints', getAdminComplaints);
router.patch('/complaints/:id/status', updateComplaintStatus);

// Analytics, Activity Logs & Platform Settings
router.get('/analytics', getPlatformAnalytics);
router.get('/activity-logs', getActivityLogs);
router.get('/settings', getPlatformSettings);
router.patch('/settings', updatePlatformSettings);

module.exports = router;
