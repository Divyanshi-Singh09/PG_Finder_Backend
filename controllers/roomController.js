const Room = require('../models/Room');
const Bed = require('../models/Bed');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');

// Memory store fallback for local dev
const memoryRooms = [];
const memoryBeds = [];

/**
 * Generate Beds automatically when a room is created
 */
const generateBedsForRoom = async (pgId, roomId, totalBeds, isMemory = false) => {
  const generatedBeds = [];
  for (let i = 1; i <= totalBeds; i++) {
    const bedNumber = `Bed ${i}`;
    if (!isMemory) {
      const bed = await Bed.create({
        pg: pgId,
        room: roomId,
        bedNumber,
        status: 'AVAILABLE',
      });
      generatedBeds.push(bed);
    } else {
      const bed = {
        _id: `bed-mem-${Date.now()}-${i}`,
        id: `bed-mem-${Date.now()}-${i}`,
        pg: pgId,
        room: roomId,
        bedNumber,
        status: 'AVAILABLE',
        currentBooking: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryBeds.push(bed);
      generatedBeds.push(bed);
    }
  }
  return generatedBeds;
};

/**
 * @desc    Create a new Room + Auto-generate Beds
 * @route   POST /api/rooms
 * @access  Private (OWNER, ADMIN)
 */
const createRoom = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { pgId, roomNumber, roomType = 'DOUBLE', totalBeds = 2, rent, securityDeposit = 0, amenities = [], status = 'ACTIVE' } = req.body;

    if (!pgId || !roomNumber || rent === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PG ID, room number, and monthly rent.',
      });
    }

    if (parseInt(totalBeds) < 1 || parseInt(rent) < 0 || parseInt(securityDeposit) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Beds must be at least 1, and rent/deposit cannot be negative.',
      });
    }

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findById(pgId);
      if (!pg || pg.isDeleted) return res.status(404).json({ success: false, message: 'PG property not found.' });

      if (req.user.role !== 'ADMIN' && pg.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to add rooms to this PG.' });
      }

      // Check unique room number
      const existing = await Room.findOne({ pg: pgId, roomNumber: roomNumber.trim() });
      if (existing) {
        return res.status(400).json({ success: false, message: `Room number "${roomNumber.trim()}" already exists in this PG.` });
      }

      const room = await Room.create({
        pg: pgId,
        owner: ownerId,
        roomNumber: roomNumber.trim(),
        roomType: roomType.toUpperCase(),
        totalBeds: parseInt(totalBeds),
        availableBeds: parseInt(totalBeds),
        rent: parseFloat(rent),
        securityDeposit: parseFloat(securityDeposit),
        amenities,
        status: status.toUpperCase(),
      });

      const beds = await generateBedsForRoom(pgId, room._id, parseInt(totalBeds), false);

      return res.status(201).json({
        success: true,
        message: `Room ${roomNumber} created with ${totalBeds} available beds!`,
        data: { room, beds },
      });
    } else {
      pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found.' });

      const actualOwnerId = (pg.owner?._id || pg.owner?.id || pg.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to add rooms to this PG.' });
      }

      const existing = memoryRooms.find((r) => (r.pg === pgId || r.pg?._id === pgId) && r.roomNumber.toLowerCase() === roomNumber.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: `Room number "${roomNumber.trim()}" already exists in this PG.` });
      }

      const newRoom = {
        _id: `rm-mem-${Date.now()}`,
        id: `rm-mem-${Date.now()}`,
        pg: pgId,
        owner: ownerId,
        roomNumber: roomNumber.trim(),
        roomType: roomType.toUpperCase(),
        totalBeds: parseInt(totalBeds),
        availableBeds: parseInt(totalBeds),
        rent: parseFloat(rent),
        securityDeposit: parseFloat(securityDeposit),
        amenities,
        status: status.toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      memoryRooms.unshift(newRoom);
      const beds = await generateBedsForRoom(pgId, newRoom._id, parseInt(totalBeds), true);

      return res.status(201).json({
        success: true,
        message: `Room ${roomNumber} created with ${totalBeds} available beds!`,
        data: { room: newRoom, beds },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all rooms for a PG with bed status info
 * @route   GET /api/pgs/:pgId/rooms
 * @access  Public / Authenticated
 */
const getRoomsByPG = async (req, res, next) => {
  try {
    const { pgId } = req.params;

    if (checkDBConnection()) {
      const rooms = await Room.find({ pg: pgId }).sort({ roomNumber: 1 });
      const roomsWithBeds = await Promise.all(
        rooms.map(async (rm) => {
          const beds = await Bed.find({ room: rm._id }).sort({ bedNumber: 1 });
          const roomObj = rm.toObject();
          roomObj.beds = beds;
          return roomObj;
        })
      );

      return res.status(200).json({
        success: true,
        data: { rooms: roomsWithBeds },
      });
    } else {
      const rooms = memoryRooms.filter((r) => r.pg === pgId || r.pg?._id === pgId || r.pg?.id === pgId);
      const roomsWithBeds = rooms.map((rm) => {
        const rmId = rm._id || rm.id;
        const beds = memoryBeds.filter((b) => b.room === rmId || b.room?._id === rmId || b.room?.id === rmId);
        return {
          ...rm,
          beds,
        };
      });

      return res.status(200).json({
        success: true,
        data: { rooms: roomsWithBeds },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single room details + beds
 * @route   GET /api/rooms/:id
 * @access  Public / Authenticated
 */
const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (checkDBConnection()) {
      const room = await Room.findById(id).populate('pg', 'name address owner status onlineBookingEnabled');
      if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

      const beds = await Bed.find({ room: room._id }).sort({ bedNumber: 1 });
      const dataObj = room.toObject();
      dataObj.beds = beds;

      return res.status(200).json({ success: true, data: { room: dataObj } });
    } else {
      const room = memoryRooms.find((r) => r._id === id || r.id === id);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

      const beds = memoryBeds.filter((b) => b.room === id || b.room?._id === id);
      return res.status(200).json({ success: true, data: { room: { ...room, beds } } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Room details (rent, deposit, status, amenities)
 * @route   PATCH /api/rooms/:id
 * @access  Private (OWNER, ADMIN)
 */
const updateRoom = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { rent, securityDeposit, status, amenities } = req.body;

    if (checkDBConnection()) {
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

      if (req.user.role !== 'ADMIN' && room.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to update this room.' });
      }

      if (rent !== undefined) room.rent = parseFloat(rent);
      if (securityDeposit !== undefined) room.securityDeposit = parseFloat(securityDeposit);
      if (status) room.status = status.toUpperCase();
      if (amenities) room.amenities = amenities;

      await room.save();

      return res.status(200).json({
        success: true,
        message: 'Room details updated successfully.',
        data: { room },
      });
    } else {
      const room = memoryRooms.find((r) => r._id === req.params.id || r.id === req.params.id);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

      const actualOwnerId = (room.owner?._id || room.owner?.id || room.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to update this room.' });
      }

      if (rent !== undefined) room.rent = parseFloat(rent);
      if (securityDeposit !== undefined) room.securityDeposit = parseFloat(securityDeposit);
      if (status) room.status = status.toUpperCase();
      if (amenities) room.amenities = amenities;

      return res.status(200).json({
        success: true,
        message: 'Room details updated successfully.',
        data: { room },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Room (if no occupied beds)
 * @route   DELETE /api/rooms/:id
 * @access  Private (OWNER, ADMIN)
 */
const deleteRoom = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

      if (req.user.role !== 'ADMIN' && room.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to delete this room.' });
      }

      const activeBeds = await Bed.find({ room: room._id, status: { $in: ['OCCUPIED', 'RESERVED'] } });
      if (activeBeds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete room with occupied or reserved beds.',
        });
      }

      await Bed.deleteMany({ room: room._id });
      await room.deleteOne();

      return res.status(200).json({ success: true, message: 'Room deleted successfully.' });
    } else {
      const roomIdx = memoryRooms.findIndex((r) => r._id === req.params.id || r.id === req.params.id);
      if (roomIdx === -1) return res.status(404).json({ success: false, message: 'Room not found.' });

      const room = memoryRooms[roomIdx];
      const actualOwnerId = (room.owner?._id || room.owner?.id || room.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to delete this room.' });
      }

      const rmId = room._id || room.id;
      const activeBeds = memoryBeds.filter(
        (b) => (b.room === rmId || b.room?._id === rmId) && ['OCCUPIED', 'RESERVED'].includes(b.status)
      );

      if (activeBeds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete room with occupied or reserved beds.',
        });
      }

      memoryRooms.splice(roomIdx, 1);
      return res.status(200).json({ success: true, message: 'Room deleted successfully.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get beds for a room
 * @route   GET /api/rooms/:roomId/beds
 * @access  Private / Public
 */
const getRoomBeds = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (checkDBConnection()) {
      const beds = await Bed.find({ room: roomId }).sort({ bedNumber: 1 });
      return res.status(200).json({ success: true, data: { beds } });
    } else {
      const beds = memoryBeds.filter((b) => b.room === roomId || b.room?._id === roomId || b.room?.id === roomId);
      return res.status(200).json({ success: true, data: { beds } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner updates Bed Status (AVAILABLE <-> MAINTENANCE)
 * @route   PATCH /api/beds/:id
 * @access  Private (OWNER, ADMIN)
 */
const updateBedStatus = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { status } = req.body;

    if (!status || !['AVAILABLE', 'MAINTENANCE'].includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Bed status can only be set to AVAILABLE or MAINTENANCE.' });
    }

    if (checkDBConnection()) {
      const bed = await Bed.findById(req.params.id).populate('room');
      if (!bed) return res.status(404).json({ success: false, message: 'Bed not found.' });

      if (['OCCUPIED', 'RESERVED'].includes(bed.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status of a bed that is currently ${bed.status}.`,
        });
      }

      bed.status = status.toUpperCase();
      await bed.save();

      // Recalculate room available beds
      const availCount = await Bed.countDocuments({ room: bed.room._id, status: 'AVAILABLE' });
      await Room.findByIdAndUpdate(bed.room._id, { availableBeds: availCount });

      return res.status(200).json({ success: true, message: `Bed status updated to ${status.toUpperCase()}.`, data: { bed } });
    } else {
      const bed = memoryBeds.find((b) => b._id === req.params.id || b.id === req.params.id);
      if (!bed) return res.status(404).json({ success: false, message: 'Bed not found.' });

      if (['OCCUPIED', 'RESERVED'].includes(bed.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status of a bed that is currently ${bed.status}.`,
        });
      }

      bed.status = status.toUpperCase();

      const rmId = bed.room?._id || bed.room?.id || bed.room;
      const room = memoryRooms.find((r) => r._id === rmId || r.id === rmId);
      if (room) {
        const availCount = memoryBeds.filter((b) => (b.room === rmId || b.room?._id === rmId) && b.status === 'AVAILABLE').length;
        room.availableBeds = availCount;
      }

      return res.status(200).json({ success: true, message: `Bed status updated to ${status.toUpperCase()}.`, data: { bed } });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getRoomsByPG,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomBeds,
  updateBedStatus,
  memoryRooms,
  memoryBeds,
};
