const express = require('express');
const router = express.Router();
const { getOwnerAnalytics } = require('../controllers/ownerAnalyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorizeRoles('OWNER', 'ADMIN'));

router.get('/', getOwnerAnalytics);

module.exports = router;
