const AvailabilitySlot = require('../models/AvailabilitySlot');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');

// Memory store fallback for availability slots in local dev
const memoryAvailabilitySlots = [
  {
    _id: 'slot-mem-001',
    id: 'slot-mem-001',
    owner: 'usr-mem-002',
    pg: 'pg-appr-001',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    maxVisitors: 3,
    bookedVisitors: 0,
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'slot-mem-002',
    id: 'slot-mem-002',
    owner: 'usr-mem-002',
    pg: 'pg-appr-001',
    date: new Date(Date.now() + 86400000).toISOString(),
    startTime: '04:00 PM',
    endTime: '05:00 PM',
    maxVisitors: 2,
    bookedVisitors: 0,
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
  },
];

/**
 * @desc    Create a visit availability slot (Owner -> Property)
 * @route   POST /api/availability
 * @access  Private (OWNER, ADMIN)
 */
const createSlot = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { pgId, date, startTime, endTime, maxVisitors = 3 } = req.body;

    if (!pgId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PG ID, date, start time, and end time.',
      });
    }

    const slotDate = new Date(date);
    if (isNaN(slotDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid slot date.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Availability slot date cannot be in the past.',
      });
    }

    const maxCap = Math.max(1, parseInt(maxVisitors) || 3);

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: pgId, isDeleted: false });
    } else {
      pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
    }

    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG property listing not found.' });
    }

    const actualOwnerId = (pg.owner?._id || pg.owner?.id || pg.owner).toString();
    if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create availability slots for your own properties.',
      });
    }

    // Duplicate/Overlap Check
    if (checkDBConnection()) {
      const existing = await AvailabilitySlot.findOne({
        pg: pgId,
        date: slotDate,
        startTime: startTime.trim(),
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An availability slot for this date and time already exists for this property.',
        });
      }

      const slot = await AvailabilitySlot.create({
        owner: actualOwnerId,
        pg: pgId,
        date: slotDate,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        maxVisitors: maxCap,
        bookedVisitors: 0,
        status: 'AVAILABLE',
      });

      return res.status(201).json({
        success: true,
        message: 'Visit availability slot created successfully.',
        data: { slot },
      });
    } else {
      const existing = memoryAvailabilitySlots.find(
        (s) => (s.pg === pgId || s.pg?._id === pgId) &&
               new Date(s.date).toDateString() === slotDate.toDateString() &&
               s.startTime === startTime.trim()
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An availability slot for this date and time already exists for this property.',
        });
      }

      const newSlot = {
        _id: `slot-mem-${Date.now()}`,
        id: `slot-mem-${Date.now()}`,
        owner: actualOwnerId,
        pg: pgId,
        date: slotDate.toISOString(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        maxVisitors: maxCap,
        bookedVisitors: 0,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
      };

      memoryAvailabilitySlots.unshift(newSlot);

      return res.status(201).json({
        success: true,
        message: 'Visit availability slot created successfully.',
        data: { slot: newSlot },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public available visit slots for a PG
 * @route   GET /api/pgs/:pgId/availability
 * @access  Public
 */
const getPublicPGAvailability = async (req, res, next) => {
  try {
    const { pgId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkDBConnection()) {
      const slots = await AvailabilitySlot.find({
        pg: pgId,
        status: 'AVAILABLE',
        date: { $gte: today },
      }).sort({ date: 1, startTime: 1 });

      const filtered = slots.filter((s) => s.bookedVisitors < s.maxVisitors);

      return res.status(200).json({
        success: true,
        data: { slots: filtered },
      });
    } else {
      const slots = memoryAvailabilitySlots.filter((s) => {
        const isMatchPG = s.pg === pgId || s.pg?._id === pgId || s.pg?.id === pgId;
        const isFuture = new Date(s.date) >= today;
        const isAvail = s.status === 'AVAILABLE' && s.bookedVisitors < s.maxVisitors;
        return isMatchPG && isFuture && isAvail;
      });

      slots.sort((a, b) => new Date(a.date) - new Date(b.date));

      return res.status(200).json({
        success: true,
        data: { slots },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's created availability slots
 * @route   GET /api/availability/my
 * @access  Private (OWNER, ADMIN)
 */
const getMyAvailability = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const slots = await AvailabilitySlot.find({ owner: ownerId })
        .sort({ date: 1, startTime: 1 })
        .populate('pg', 'name address location');

      return res.status(200).json({
        success: true,
        data: { slots },
      });
    } else {
      const filtered = memoryAvailabilitySlots.filter(
        (s) => s.owner === ownerId || s.owner?.id === ownerId || req.user.role === 'ADMIN'
      );
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

      return res.status(200).json({
        success: true,
        data: { slots: filtered },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a slot (status: AVAILABLE | BLOCKED, maxVisitors)
 * @route   PATCH /api/availability/:id
 * @access  Private (OWNER, ADMIN)
 */
const updateSlot = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { status, maxVisitors } = req.body;

    let slot;
    if (checkDBConnection()) {
      slot = await AvailabilitySlot.findById(req.params.id);
    } else {
      slot = memoryAvailabilitySlots.find((s) => s._id === req.params.id || s.id === req.params.id);
    }

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Availability slot not found.' });
    }

    const actualOwnerId = (slot.owner?._id || slot.owner?.id || slot.owner).toString();
    if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this slot.',
      });
    }

    if (status && ['AVAILABLE', 'FULL', 'BLOCKED'].includes(status.toUpperCase())) {
      slot.status = status.toUpperCase();
    }

    if (maxVisitors !== undefined && !isNaN(maxVisitors)) {
      slot.maxVisitors = Math.max(1, parseInt(maxVisitors));
      if (slot.bookedVisitors >= slot.maxVisitors) {
        slot.status = 'FULL';
      }
    }

    if (checkDBConnection()) {
      await slot.save();
    }

    res.status(200).json({
      success: true,
      message: 'Availability slot updated successfully.',
      data: { slot },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a slot
 * @route   DELETE /api/availability/:id
 * @access  Private (OWNER, ADMIN)
 */
const deleteSlot = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    let slot;
    if (checkDBConnection()) {
      slot = await AvailabilitySlot.findById(req.params.id);
    } else {
      slot = memoryAvailabilitySlots.find((s) => s._id === req.params.id || s.id === req.params.id);
    }

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Availability slot not found.' });
    }

    const actualOwnerId = (slot.owner?._id || slot.owner?.id || slot.owner).toString();
    if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this slot.',
      });
    }

    if (checkDBConnection()) {
      await AvailabilitySlot.findByIdAndDelete(req.params.id);
    } else {
      const idx = memoryAvailabilitySlots.findIndex((s) => s._id === req.params.id || s.id === req.params.id);
      if (idx !== -1) memoryAvailabilitySlots.splice(idx, 1);
    }

    res.status(200).json({
      success: true,
      message: 'Availability slot deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSlot,
  getPublicPGAvailability,
  getMyAvailability,
  updateSlot,
  deleteSlot,
  memoryAvailabilitySlots,
};
