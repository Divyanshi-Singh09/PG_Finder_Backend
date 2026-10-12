const express = require('express');
const router = express.Router();
const {
  createReport,
  getAdminReports,
  updateReportStatus,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Seeker & User Report Routes
router.post('/', protect, createReport);

// Admin Report Management Routes
router.get('/admin/all', protect, authorizeRoles('ADMIN'), getAdminReports);
router.patch('/admin/:id', protect, authorizeRoles('ADMIN'), updateReportStatus);

module.exports = router;
