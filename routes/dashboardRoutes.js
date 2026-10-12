const express = require('express');
const router = express.Router();
const {
  getSeekerDashboard,
  getOwnerDashboard,
  getAdminDashboard,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/seeker', protect, authorizeRoles('SEEKER'), getSeekerDashboard);
router.get('/owner', protect, authorizeRoles('OWNER', 'ADMIN'), getOwnerDashboard);
router.get('/admin', protect, authorizeRoles('ADMIN'), getAdminDashboard);

module.exports = router;
