const Visit = require('../models/Visit');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const { memoryAvailabilitySlots } = require('./availabilityController');
const notificationService = require('../services/notificationService');

// Memory store fallback for visits in local dev
const memoryVisits = [];

/**
 * @desc    Request a PG Visit (Seeker -> Slot)
 * @route   POST /api/visits
 * @access  Private (SEEKER)
 */
const requestVisit = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId, availabilitySlotId, seekerNote = '' } = req.body;

    if (!pgId || !availabilitySlotId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PG ID and availability slot ID.',
      });
    }

    let pg, slot;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: pgId, isDeleted: false });
      if (!pg || pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Visits can only be scheduled for approved property listings.',
        });
      }

      if (pg.status === 'SUSPENDED' || pg.verificationStatus === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept visit requests.',
        });
      }

      slot = await AvailabilitySlot.findById(availabilitySlotId);
      if (!slot) {
        return res.status(404).json({ success: false, message: 'Selected availability slot not found.' });
      }

      if (slot.status !== 'AVAILABLE' || slot.bookedVisitors >= slot.maxVisitors) {
        return res.status(400).json({
          success: false,
          message: 'This visit time slot is no longer available or has reached capacity.',
        });
      }

      // Duplicate visit check
      const duplicate = await Visit.findOne({
        seeker: seekerId,
        availabilitySlot: availabilitySlotId,
        status: { $in: ['REQUESTED', 'CONFIRMED'] },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active visit request for this time slot.',
        });
      }

      const ownerId = pg.owner;
      const visit = await Visit.create({
        seeker: seekerId,
        owner: ownerId,
        pg: pgId,
        availabilitySlot: availabilitySlotId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'REQUESTED',
        seekerNote: seekerNote.trim(),
      });

      // Send Event Notification to PG Owner
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'VISIT_REQUESTED',
        title: 'New PG Visit Requested',
        message: `${req.user.name} requested a visit to ${pg.name} for ${new Date(slot.date).toLocaleDateString()} at ${slot.startTime}.`,
        entityType: 'VISIT',
        entityId: visit._id,
        actionUrl: '/owner/visits',
      });

      return res.status(201).json({
        success: true,
        message: 'Visit request submitted successfully! The owner will review your request.',
        data: { visit },
      });
    } else {
      pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
      if (!pg || pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Visits can only be scheduled for approved property listings.',
        });
      }

      if (pg.status === 'SUSPENDED' || pg.verificationStatus === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept visit requests.',
        });
      }

      slot = memoryAvailabilitySlots.find((s) => s._id === availabilitySlotId || s.id === availabilitySlotId);
      if (!slot) {
        return res.status(404).json({ success: false, message: 'Selected availability slot not found.' });
      }

      if (slot.status !== 'AVAILABLE' || slot.bookedVisitors >= slot.maxVisitors) {
        return res.status(400).json({
          success: false,
          message: 'This visit time slot is no longer available or has reached capacity.',
        });
      }

      const duplicate = memoryVisits.find(
        (v) => (v.seeker === seekerId || v.seeker?.id === seekerId) &&
               (v.availabilitySlot === availabilitySlotId || v.availabilitySlot?.id === availabilitySlotId) &&
               ['REQUESTED', 'CONFIRMED'].includes(v.status)
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active visit request for this time slot.',
        });
      }

      const ownerId = pg.owner;
      const newVisit = {
        _id: `vis-mem-${Date.now()}`,
        id: `vis-mem-${Date.now()}`,
        seeker: seekerId,
        owner: ownerId,
        pg,
        availabilitySlot: slot,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'REQUESTED',
        seekerNote: seekerNote.trim(),
        ownerNote: '',
        cancellationReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      memoryVisits.unshift(newVisit);

      await notificationService.createNotification({
        recipient: ownerId,
        type: 'NEW_ENQUIRY',
        title: 'New PG Visit Requested',
        message: `${req.user.name} requested a visit to ${pg.name} for ${new Date(slot.date).toLocaleDateString()} at ${slot.startTime}.`,
        entityType: 'VISIT',
        entityId: newVisit._id,
      });

      return res.status(201).json({
        success: true,
        message: 'Visit request submitted successfully! The owner will review your request.',
        data: { visit: newVisit },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get seeker's scheduled visits
 * @route   GET /api/visits/my
 * @access  Private (SEEKER)
 */
const getMyVisits = async (req, res, next) => {
  try {
    const seekerId = req.user.id;

    if (checkDBConnection()) {
      const visits = await Visit.find({ seeker: seekerId })
        .sort({ date: 1, startTime: 1 })
        .populate('pg', 'name address location rent images')
        .populate('owner', 'name email mobile');

      return res.status(200).json({
        success: true,
        data: { visits },
      });
    } else {
      const filtered = memoryVisits.filter(
        (v) => v.seeker === seekerId || v.seeker?.id === seekerId
      );
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

      return res.status(200).json({
        success: true,
        data: { visits: filtered },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's received visit requests
 * @route   GET /api/visits/owner
 * @access  Private (OWNER, ADMIN)
 */
const getOwnerVisits = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const visits = await Visit.find({ owner: ownerId })
        .sort({ date: 1, startTime: 1 })
        .populate('pg', 'name address location')
        .populate('seeker', 'name email mobile');

      return res.status(200).json({
        success: true,
        data: { visits },
      });
    } else {
      const filtered = memoryVisits.filter(
        (v) => v.owner === ownerId || v.owner?.id === ownerId || req.user.role === 'ADMIN'
      );
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

      return res.status(200).json({
        success: true,
        data: { visits: filtered },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single visit details
 * @route   GET /api/visits/:id
 * @access  Private (Seeker, Owner, Admin)
 */
const getVisitById = async (req, res, next) => {
  try {
    let visit;
    if (checkDBConnection()) {
      visit = await Visit.findById(req.params.id)
        .populate('pg')
        .populate('seeker', 'name email mobile')
        .populate('owner', 'name email mobile');
    } else {
      visit = memoryVisits.find((v) => v._id === req.params.id || v.id === req.params.id);
    }

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit record not found.' });
    }

    const callerId = req.user.id.toString();
    const seekerId = (visit.seeker?._id || visit.seeker?.id || visit.seeker).toString();
    const ownerId = (visit.owner?._id || visit.owner?.id || visit.owner).toString();

    if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this visit record.',
      });
    }

    res.status(200).json({
      success: true,
      data: { visit },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner confirms a visit request & increments slot capacity
 * @route   PATCH /api/visits/:id/confirm
 * @access  Private (OWNER, ADMIN)
 */
const confirmVisit = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    let visit, slot;
    if (checkDBConnection()) {
      visit = await Visit.findById(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: 'Visit request not found.' });

      const actualOwnerId = visit.owner.toString();
      if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to confirm this visit.' });
      }

      slot = await AvailabilitySlot.findById(visit.availabilitySlot);
      if (slot) {
        if (slot.bookedVisitors >= slot.maxVisitors) {
          return res.status(400).json({
            success: false,
            message: 'This time slot is already full to capacity.',
          });
        }
        slot.bookedVisitors += 1;
        if (slot.bookedVisitors >= slot.maxVisitors) {
          slot.status = 'FULL';
        }
        await slot.save();
      }

      visit.status = 'CONFIRMED';
      await visit.save();

      // Notify Seeker
      const seekerId = visit.seeker.toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'VISIT_ACCEPTED',
        title: 'PG Visit Confirmed!',
        message: `Your visit to property on ${new Date(visit.date).toLocaleDateString()} at ${visit.startTime} was confirmed.`,
        entityType: 'VISIT',
        entityId: visit._id,
        actionUrl: '/seeker/visits',
      });

      return res.status(200).json({
        success: true,
        message: 'Visit request confirmed successfully.',
        data: { visit },
      });
    } else {
      visit = memoryVisits.find((v) => v._id === req.params.id || v.id === req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: 'Visit request not found.' });

      const actualOwnerId = (visit.owner?._id || visit.owner?.id || visit.owner).toString();
      if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to confirm this visit.' });
      }

      const slotId = visit.availabilitySlot?._id || visit.availabilitySlot?.id || visit.availabilitySlot;
      slot = memoryAvailabilitySlots.find((s) => s._id === slotId || s.id === slotId);

      if (slot) {
        if (slot.bookedVisitors >= slot.maxVisitors) {
          return res.status(400).json({
            success: false,
            message: 'This time slot is already full to capacity.',
          });
        }
        slot.bookedVisitors += 1;
        if (slot.bookedVisitors >= slot.maxVisitors) {
          slot.status = 'FULL';
        }
      }

      visit.status = 'CONFIRMED';

      const seekerId = (visit.seeker?._id || visit.seeker?.id || visit.seeker).toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'ENQUIRY_RESPONSE',
        title: 'PG Visit Confirmed!',
        message: `Your visit request for ${new Date(visit.date).toLocaleDateString()} at ${visit.startTime} has been confirmed.`,
        entityType: 'VISIT',
        entityId: visit._id || visit.id,
      });

      return res.status(200).json({
        success: true,
        message: 'Visit request confirmed successfully.',
        data: { visit },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner rejects a visit request
 * @route   PATCH /api/visits/:id/reject
 * @access  Private (OWNER, ADMIN)
 */
const rejectVisit = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { ownerNote = '' } = req.body;

    let visit;
    if (checkDBConnection()) {
      visit = await Visit.findById(req.params.id);
    } else {
      visit = memoryVisits.find((v) => v._id === req.params.id || v.id === req.params.id);
    }

    if (!visit) return res.status(404).json({ success: false, message: 'Visit request not found.' });

    const actualOwnerId = (visit.owner?._id || visit.owner?.id || visit.owner).toString();
    if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to reject this visit.' });
    }

    visit.status = 'REJECTED';
    if (ownerNote) visit.ownerNote = ownerNote.trim();

    if (checkDBConnection()) {
      await visit.save();
    }

    const seekerId = (visit.seeker?._id || visit.seeker?.id || visit.seeker).toString();
    await notificationService.createNotification({
      recipient: seekerId,
      type: 'ENQUIRY_RESPONSE',
      title: 'Visit Request Update',
      message: `Your visit request for ${new Date(visit.date).toLocaleDateString()} could not be confirmed.`,
      entityType: 'VISIT',
      entityId: visit._id || visit.id,
    });

    res.status(200).json({
      success: true,
      message: 'Visit request rejected.',
      data: { visit },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel a visit & restore slot capacity
 * @route   PATCH /api/visits/:id/cancel
 * @access  Private (Seeker, Owner, Admin)
 */
const cancelVisit = async (req, res, next) => {
  try {
    const callerId = req.user.id.toString();
    const { cancellationReason = '' } = req.body;

    let visit, slot;
    if (checkDBConnection()) {
      visit = await Visit.findById(req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: 'Visit record not found.' });

      const seekerId = visit.seeker.toString();
      const ownerId = visit.owner.toString();

      if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to cancel this visit.' });
      }

      // If previously confirmed, restore slot capacity
      if (visit.status === 'CONFIRMED') {
        slot = await AvailabilitySlot.findById(visit.availabilitySlot);
        if (slot) {
          slot.bookedVisitors = Math.max(0, slot.bookedVisitors - 1);
          if (slot.status === 'FULL') {
            slot.status = 'AVAILABLE';
          }
          await slot.save();
        }
      }

      visit.status = 'CANCELLED';
      if (cancellationReason) visit.cancellationReason = cancellationReason.trim();
      await visit.save();

      const otherParticipant = callerId === seekerId ? ownerId : seekerId;
      await notificationService.createNotification({
        recipient: otherParticipant,
        type: 'ENQUIRY_CLOSED',
        title: 'PG Visit Cancelled',
        message: `A scheduled PG visit on ${new Date(visit.date).toLocaleDateString()} has been cancelled.`,
        entityType: 'VISIT',
        entityId: visit._id,
      });

      return res.status(200).json({
        success: true,
        message: 'Visit cancelled successfully.',
        data: { visit },
      });
    } else {
      visit = memoryVisits.find((v) => v._id === req.params.id || v.id === req.params.id);
      if (!visit) return res.status(404).json({ success: false, message: 'Visit record not found.' });

      const seekerId = (visit.seeker?._id || visit.seeker?.id || visit.seeker).toString();
      const ownerId = (visit.owner?._id || visit.owner?.id || visit.owner).toString();

      if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to cancel this visit.' });
      }

      if (visit.status === 'CONFIRMED') {
        const slotId = visit.availabilitySlot?._id || visit.availabilitySlot?.id || visit.availabilitySlot;
        slot = memoryAvailabilitySlots.find((s) => s._id === slotId || s.id === slotId);
        if (slot) {
          slot.bookedVisitors = Math.max(0, slot.bookedVisitors - 1);
          if (slot.status === 'FULL') {
            slot.status = 'AVAILABLE';
          }
        }
      }

      visit.status = 'CANCELLED';
      if (cancellationReason) visit.cancellationReason = cancellationReason.trim();

      const otherParticipant = callerId === seekerId ? ownerId : seekerId;
      await notificationService.createNotification({
        recipient: otherParticipant,
        type: 'ENQUIRY_CLOSED',
        title: 'PG Visit Cancelled',
        message: `A scheduled PG visit on ${new Date(visit.date).toLocaleDateString()} has been cancelled.`,
        entityType: 'VISIT',
        entityId: visit._id || visit.id,
      });

      return res.status(200).json({
        success: true,
        message: 'Visit cancelled successfully.',
        data: { visit },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update visit status to COMPLETED or NO_SHOW
 * @route   PATCH /api/visits/:id/status
 * @access  Private (OWNER, ADMIN)
 */
const updateVisitStatus = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { status } = req.body;

    if (!status || !['COMPLETED', 'NO_SHOW'].includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Status must be COMPLETED or NO_SHOW.' });
    }

    let visit;
    if (checkDBConnection()) {
      visit = await Visit.findById(req.params.id);
    } else {
      visit = memoryVisits.find((v) => v._id === req.params.id || v.id === req.params.id);
    }

    if (!visit) return res.status(404).json({ success: false, message: 'Visit record not found.' });

    const actualOwnerId = (visit.owner?._id || visit.owner?.id || visit.owner).toString();
    if (req.user.role !== 'ADMIN' && ownerId.toString() !== actualOwnerId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this visit.' });
    }

    visit.status = status.toUpperCase();

    if (checkDBConnection()) {
      await visit.save();
    }

    res.status(200).json({
      success: true,
      message: `Visit marked as ${status.toUpperCase()}.`,
      data: { visit },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin platform visits monitoring list
 * @route   GET /api/admin/visits
 * @access  Private (ADMIN)
 */
const getAdminVisits = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const total = await Visit.countDocuments(filter);
      const visits = await Visit.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('pg', 'name address')
        .populate('seeker', 'name email mobile')
        .populate('owner', 'name email mobile');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { visits, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      let filtered = [...memoryVisits];
      if (status && status.trim() !== '') filtered = filtered.filter((v) => v.status === status.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { visits: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestVisit,
  getMyVisits,
  getOwnerVisits,
  getVisitById,
  confirmVisit,
  rejectVisit,
  cancelVisit,
  updateVisitStatus,
  getAdminVisits,
  memoryVisits,
};
