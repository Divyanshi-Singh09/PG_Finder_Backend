const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRoomsByPG,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomBeds,
  updateBedStatus,
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Room & Bed Routes
router.post('/', protect, authorizeRoles('OWNER', 'ADMIN'), createRoom);
router.get('/pg/:pgId', getRoomsByPG);
router.get('/:id', getRoomById);
router.patch('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), updateRoom);
router.delete('/:id', protect, authorizeRoles('OWNER', 'ADMIN'), deleteRoom);

router.get('/:roomId/beds', getRoomBeds);
router.patch('/beds/:id', protect, authorizeRoles('OWNER', 'ADMIN'), updateBedStatus);

module.exports = router;
