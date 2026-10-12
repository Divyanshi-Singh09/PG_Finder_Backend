const express = require('express');
const router = express.Router();
const { getFacilities, createFacility, updateFacilityStatus } = require('../controllers/facilityController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', getFacilities);

router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.post('/', createFacility);
router.patch('/:id', updateFacilityStatus);

module.exports = router;
