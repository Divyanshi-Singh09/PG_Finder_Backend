const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Bed = require('../models/Bed');
const PG = require('../models/PG');
const VerificationAuditLog = require('../models/VerificationAuditLog');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const { memoryRooms, memoryBeds } = require('./roomController');
const notificationService = require('../services/notificationService');

// Memory store fallback for local dev
const memoryBookings = [];
let bookingCounter = 100;

/**
 * Generate Unique Human-Readable Booking Reference Number (e.g. PG-2026-000101)
 */
const generateBookingReference = () => {
  bookingCounter += 1;
  const year = new Date().getFullYear();
  const seq = String(bookingCounter).padStart(6, '0');
  return `PG-${year}-${seq}`;
};

/**
 * Recalculate room available beds and update room status
 */
const syncRoomAvailability = async (roomId) => {
  if (checkDBConnection()) {
    const availCount = await Bed.countDocuments({ room: roomId, status: 'AVAILABLE' });
    const room = await Room.findById(roomId);
    if (room) {
      room.availableBeds = availCount;
      if (availCount === 0 && room.status === 'ACTIVE') {
        room.status = 'FULL';
      } else if (availCount > 0 && room.status === 'FULL') {
        room.status = 'ACTIVE';
      }
      await room.save();
    }
  } else {
    const rmId = roomId?._id || roomId?.id || roomId;
    const room = memoryRooms.find((r) => r._id === rmId || r.id === rmId);
    if (room) {
      const availCount = memoryBeds.filter((b) => (b.room === rmId || b.room?._id === rmId) && b.status === 'AVAILABLE').length;
      room.availableBeds = availCount;
      if (availCount === 0 && room.status === 'ACTIVE') {
        room.status = 'FULL';
      } else if (availCount > 0 && room.status === 'FULL') {
        room.status = 'ACTIVE';
      }
    }
  }
};

/**
 * @desc    Submit a Room Booking Request (Seeker -> Owner)
 * @route   POST /api/bookings
 * @access  Private (SEEKER)
 */
const createBooking = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId, roomId, bedId, moveInDate, seekerMessage = '' } = req.body;

    if (!pgId || !roomId || !bedId || !moveInDate) {
      return res.status(400).json({
        success: false,
        message: 'Please select a PG, room, available bed, and move-in date.',
      });
    }

    const moveIn = new Date(moveInDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(moveIn.getTime()) || moveIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Move-in date cannot be in the past.',
      });
    }

    let pg, room, bed;

    if (checkDBConnection()) {
      pg = await PG.findById(pgId);
      if (!pg || pg.isDeleted || pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Booking requests can only be placed for approved property listings.',
        });
      }

      if (pg.verificationStatus === 'SUSPENDED' || pg.status === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept booking requests.',
        });
      }

      if (pg.onlineBookingEnabled === false) {
        return res.status(400).json({
          success: false,
          message: 'Online booking is currently turned off for this property. Please send an enquiry or schedule a visit.',
        });
      }

      room = await Room.findById(roomId);
      if (!room || room.pg.toString() !== pgId.toString() || room.status === 'INACTIVE') {
        return res.status(400).json({ success: false, message: 'Selected room is not available for booking.' });
      }

      if (room.status === 'MAINTENANCE') {
        return res.status(400).json({ success: false, message: 'This room is currently under maintenance.' });
      }

      bed = await Bed.findById(bedId);
      if (!bed || bed.room.toString() !== roomId.toString()) {
        return res.status(404).json({ success: false, message: 'Selected bed not found.' });
      }

      if (bed.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: `Bed ${bed.bedNumber} is currently ${bed.status.toLowerCase()} and cannot be booked.`,
        });
      }

      // Check Duplicate Active Booking
      const duplicate = await Booking.findOne({
        seeker: seekerId,
        bed: bedId,
        status: { $in: ['PENDING', 'ACCEPTED'] },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active booking request for this bed.',
        });
      }

      // Reserve Bed Atomic
      bed.status = 'RESERVED';
      await bed.save();

      const bookingRef = generateBookingReference();
      const ownerId = pg.owner;

      const booking = await Booking.create({
        bookingReference: bookingRef,
        seeker: seekerId,
        owner: ownerId,
        pg: pgId,
        room: roomId,
        bed: bedId,
        moveInDate: moveIn,
        rentAtBooking: room.rent,
        securityDepositAtBooking: room.securityDeposit,
        status: 'PENDING',
        seekerMessage: seekerMessage.trim(),
      });

      bed.currentBooking = booking._id;
      await bed.save();

      await syncRoomAvailability(roomId);

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'BOOKING',
        entityId: booking._id,
        action: 'SUBMITTED',
        performedBy: seekerId,
        reason: `Booking request ${bookingRef} created for ${bed.bedNumber}`,
      });

      // Send Event Notification to Owner
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'BOOKING_REQUEST',
        title: 'New Room Booking Request!',
        message: `${req.user.name} submitted a booking request (${bookingRef}) for ${room.roomNumber} - ${bed.bedNumber} moving in on ${moveIn.toLocaleDateString()}.`,
        entityType: 'BOOKING',
        entityId: booking._id,
        actionUrl: '/owner/booking-requests',
      });

      return res.status(201).json({
        success: true,
        message: `Booking request (${bookingRef}) submitted! Landlord will review your request.`,
        data: { booking },
      });
    } else {
      pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
      if (!pg || pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Booking requests can only be placed for approved property listings.',
        });
      }

      if (pg.verificationStatus === 'SUSPENDED' || pg.status === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept booking requests.',
        });
      }

      if (pg.onlineBookingEnabled === false) {
        return res.status(400).json({
          success: false,
          message: 'Online booking is currently turned off for this property.',
        });
      }

      room = memoryRooms.find((r) => r._id === roomId || r.id === roomId);
      if (!room || room.status === 'INACTIVE' || room.status === 'MAINTENANCE') {
        return res.status(400).json({ success: false, message: 'Selected room is not available for booking.' });
      }

      bed = memoryBeds.find((b) => b._id === bedId || b.id === bedId);
      if (!bed || bed.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: 'Selected bed is no longer available.',
        });
      }

      const duplicate = memoryBookings.find(
        (bk) => (bk.seeker === seekerId || bk.seeker?.id === seekerId) &&
                (bk.bed === bedId || bk.bed?.id === bedId) &&
                ['PENDING', 'ACCEPTED'].includes(bk.status)
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active booking request for this bed.',
        });
      }

      bed.status = 'RESERVED';
      const bookingRef = generateBookingReference();
      const ownerId = pg.owner?._id || pg.owner?.id || pg.owner;

      const newBooking = {
        _id: `bk-mem-${Date.now()}`,
        id: `bk-mem-${Date.now()}`,
        bookingReference: bookingRef,
        seeker: seekerId,
        owner: ownerId,
        pg,
        room,
        bed,
        moveInDate: moveIn.toISOString(),
        rentAtBooking: room.rent,
        securityDepositAtBooking: room.securityDeposit,
        status: 'PENDING',
        seekerMessage: seekerMessage.trim(),
        ownerResponse: '',
        cancellationReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      bed.currentBooking = newBooking._id;
      memoryBookings.unshift(newBooking);
      await syncRoomAvailability(roomId);

      await notificationService.createNotification({
        recipient: ownerId,
        type: 'NEW_ENQUIRY',
        title: 'New Room Booking Request!',
        message: `${req.user.name} submitted a booking request (${bookingRef}) for ${room.roomNumber} moving in on ${moveIn.toLocaleDateString()}.`,
        entityType: 'BOOKING',
        entityId: newBooking._id,
      });

      return res.status(201).json({
        success: true,
        message: `Booking request (${bookingRef}) submitted! Landlord will review your request.`,
        data: { booking: newBooking },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner Accepts Booking Request (Bed -> OCCUPIED)
 * @route   PATCH /api/bookings/:id/accept
 * @access  Private (OWNER, ADMIN)
 */
const acceptBooking = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    let booking, bed;
    if (checkDBConnection()) {
      booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      if (req.user.role !== 'ADMIN' && booking.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to accept this booking.' });
      }

      if (booking.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `Booking request is currently ${booking.status}.` });
      }

      bed = await Bed.findById(booking.bed);
      if (bed) {
        bed.status = 'OCCUPIED';
        await bed.save();
      }

      booking.status = 'ACCEPTED';
      booking.acceptedAt = new Date();
      await booking.save();

      await syncRoomAvailability(booking.room);

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'BOOKING',
        entityId: booking._id,
        action: 'APPROVED',
        performedBy: ownerId,
        reason: `Booking ${booking.bookingReference} accepted. Bed set to OCCUPIED.`,
      });

      // Send Event Notification to Seeker
      await notificationService.createNotification({
        recipient: booking.seeker,
        type: 'BOOKING_ACCEPTED',
        title: 'Booking Request Accepted! 🎉',
        message: `Your booking request (${booking.bookingReference}) has been ACCEPTED by the landlord. Congratulations!`,
        entityType: 'BOOKING',
        entityId: booking._id,
        actionUrl: '/seeker/bookings',
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} accepted! Bed is now occupied.`,
        data: { booking },
      });
    } else {
      booking = memoryBookings.find((b) => b._id === req.params.id || b.id === req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      const actualOwnerId = (booking.owner?._id || booking.owner?.id || booking.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to accept this booking.' });
      }

      if (booking.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `Booking request is currently ${booking.status}.` });
      }

      const bedId = booking.bed?._id || booking.bed?.id || booking.bed;
      bed = memoryBeds.find((b) => b._id === bedId || b.id === bedId);
      if (bed) {
        bed.status = 'OCCUPIED';
      }

      booking.status = 'ACCEPTED';
      booking.acceptedAt = new Date().toISOString();

      const roomId = booking.room?._id || booking.room?.id || booking.room;
      await syncRoomAvailability(roomId);

      const seekerId = (booking.seeker?._id || booking.seeker?.id || booking.seeker).toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'ENQUIRY_RESPONSE',
        title: 'Booking Request Accepted! 🎉',
        message: `Your booking request (${booking.bookingReference}) has been ACCEPTED by the landlord. Congratulations!`,
        entityType: 'BOOKING',
        entityId: booking._id || booking.id,
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} accepted! Bed is now occupied.`,
        data: { booking },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner Rejects Booking Request (Bed -> AVAILABLE)
 * @route   PATCH /api/bookings/:id/reject
 * @access  Private (OWNER, ADMIN)
 */
const rejectBooking = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { ownerResponse = '' } = req.body;

    let booking, bed;
    if (checkDBConnection()) {
      booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      if (req.user.role !== 'ADMIN' && booking.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to reject this booking.' });
      }

      if (booking.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `Booking request is currently ${booking.status}.` });
      }

      bed = await Bed.findById(booking.bed);
      if (bed) {
        bed.status = 'AVAILABLE';
        bed.currentBooking = null;
        await bed.save();
      }

      booking.status = 'REJECTED';
      booking.rejectedAt = new Date();
      if (ownerResponse) booking.ownerResponse = ownerResponse.trim();
      await booking.save();

      await syncRoomAvailability(booking.room);

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'BOOKING',
        entityId: booking._id,
        action: 'REJECTED',
        performedBy: ownerId,
        reason: `Booking ${booking.bookingReference} rejected. Reason: ${ownerResponse}`,
      });

      // Notify Seeker
      await notificationService.createNotification({
        recipient: booking.seeker,
        type: 'BOOKING_REJECTED',
        title: 'Booking Request Update',
        message: `Your booking request (${booking.bookingReference}) could not be accepted. Reason: ${ownerResponse || 'Room no longer available'}`,
        entityType: 'BOOKING',
        entityId: booking._id,
        actionUrl: '/seeker/bookings',
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} rejected. Bed restored to available.`,
        data: { booking },
      });
    } else {
      booking = memoryBookings.find((b) => b._id === req.params.id || b.id === req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      const actualOwnerId = (booking.owner?._id || booking.owner?.id || booking.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'You are not authorized to reject this booking.' });
      }

      if (booking.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `Booking request is currently ${booking.status}.` });
      }

      const bedId = booking.bed?._id || booking.bed?.id || booking.bed;
      bed = memoryBeds.find((b) => b._id === bedId || b.id === bedId);
      if (bed) {
        bed.status = 'AVAILABLE';
        bed.currentBooking = null;
      }

      booking.status = 'REJECTED';
      booking.rejectedAt = new Date().toISOString();
      if (ownerResponse) booking.ownerResponse = ownerResponse.trim();

      const roomId = booking.room?._id || booking.room?.id || booking.room;
      await syncRoomAvailability(roomId);

      const seekerId = (booking.seeker?._id || booking.seeker?.id || booking.seeker).toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'ENQUIRY_RESPONSE',
        title: 'Booking Request Update',
        message: `Your booking request (${booking.bookingReference}) could not be accepted. Reason: ${ownerResponse || 'Room no longer available'}`,
        entityType: 'BOOKING',
        entityId: booking._id || booking.id,
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} rejected. Bed restored to available.`,
        data: { booking },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel Booking Request (Seeker / Owner)
 * @route   PATCH /api/bookings/:id/cancel
 * @access  Private (Seeker, Owner, Admin)
 */
const cancelBooking = async (req, res, next) => {
  try {
    const callerId = req.user.id.toString();
    const { cancellationReason = '' } = req.body;

    let booking, bed;
    if (checkDBConnection()) {
      booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      const seekerId = booking.seeker.toString();
      const ownerId = booking.owner.toString();

      if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to cancel this booking.' });
      }

      if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
      }

      // Restore Bed Availability
      bed = await Bed.findById(booking.bed);
      if (bed) {
        bed.status = 'AVAILABLE';
        bed.currentBooking = null;
        await bed.save();
      }

      booking.status = 'CANCELLED';
      booking.cancelledAt = new Date();
      if (cancellationReason) booking.cancellationReason = cancellationReason.trim();
      await booking.save();

      await syncRoomAvailability(booking.room);

      // Audit Log
      await VerificationAuditLog.create({
        entityType: 'BOOKING',
        entityId: booking._id,
        action: 'CANCELLED',
        performedBy: callerId,
        reason: `Booking ${booking.bookingReference} cancelled. Reason: ${cancellationReason}`,
      });

      const notifyRecipient = callerId === seekerId ? ownerId : seekerId;
      await notificationService.createNotification({
        recipient: notifyRecipient,
        type: 'ENQUIRY_CLOSED',
        title: 'Booking Request Cancelled',
        message: `Booking request (${booking.bookingReference}) has been cancelled.`,
        entityType: 'BOOKING',
        entityId: booking._id,
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} cancelled.`,
        data: { booking },
      });
    } else {
      booking = memoryBookings.find((b) => b._id === req.params.id || b.id === req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

      const seekerId = (booking.seeker?._id || booking.seeker?.id || booking.seeker).toString();
      const ownerId = (booking.owner?._id || booking.owner?.id || booking.owner).toString();

      if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to cancel this booking.' });
      }

      if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
      }

      const bedId = booking.bed?._id || booking.bed?.id || booking.bed;
      bed = memoryBeds.find((b) => b._id === bedId || b.id === bedId);
      if (bed) {
        bed.status = 'AVAILABLE';
        bed.currentBooking = null;
      }

      booking.status = 'CANCELLED';
      booking.cancelledAt = new Date().toISOString();
      if (cancellationReason) booking.cancellationReason = cancellationReason.trim();

      const roomId = booking.room?._id || booking.room?.id || booking.room;
      await syncRoomAvailability(roomId);

      const notifyRecipient = callerId === seekerId ? ownerId : seekerId;
      await notificationService.createNotification({
        recipient: notifyRecipient,
        type: 'ENQUIRY_CLOSED',
        title: 'Booking Request Cancelled',
        message: `Booking request (${booking.bookingReference}) has been cancelled.`,
        entityType: 'BOOKING',
        entityId: booking._id || booking.id,
      });

      return res.status(200).json({
        success: true,
        message: `Booking ${booking.bookingReference} cancelled.`,
        data: { booking },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get seeker's bookings
 * @route   GET /api/bookings/my
 * @access  Private (SEEKER)
 */
const getMyBookings = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { status } = req.query;

    if (checkDBConnection()) {
      const filter = { seeker: seekerId };
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const bookings = await Booking.find(filter)
        .sort({ createdAt: -1 })
        .populate('pg', 'name address location rent images')
        .populate('room', 'roomNumber roomType rent')
        .populate('bed', 'bedNumber status')
        .populate('owner', 'name email mobile');

      return res.status(200).json({ success: true, data: { bookings } });
    } else {
      let filtered = memoryBookings.filter(
        (b) => b.seeker === seekerId || b.seeker?._id === seekerId || b.seeker?.id === seekerId
      );
      if (status && status.trim() !== '') filtered = filtered.filter((b) => b.status === status.toUpperCase());

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ success: true, data: { bookings: filtered } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's received booking requests
 * @route   GET /api/owner/bookings
 * @access  Private (OWNER, ADMIN)
 */
const getOwnerBookings = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { status } = req.query;

    if (checkDBConnection()) {
      const filter = { owner: ownerId };
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const bookings = await Booking.find(filter)
        .sort({ createdAt: -1 })
        .populate('pg', 'name address location')
        .populate('room', 'roomNumber roomType rent')
        .populate('bed', 'bedNumber status')
        .populate('seeker', 'name email mobile');

      return res.status(200).json({ success: true, data: { bookings } });
    } else {
      let filtered = memoryBookings.filter(
        (b) => b.owner === ownerId || b.owner?._id === ownerId || b.owner?.id === ownerId || req.user.role === 'ADMIN'
      );
      if (status && status.trim() !== '') filtered = filtered.filter((b) => b.status === status.toUpperCase());

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ success: true, data: { bookings: filtered } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's bed occupancy dashboard statistics
 * @route   GET /api/owner/occupancy
 * @access  Private (OWNER, ADMIN)
 */
const getOwnerOccupancy = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const pgs = await PG.find({ owner: ownerId, isDeleted: false });
      const pgIds = pgs.map((p) => p._id);

      const totalBeds = await Bed.countDocuments({ pg: { $in: pgIds } });
      const available = await Bed.countDocuments({ pg: { $in: pgIds }, status: 'AVAILABLE' });
      const reserved = await Bed.countDocuments({ pg: { $in: pgIds }, status: 'RESERVED' });
      const occupied = await Bed.countDocuments({ pg: { $in: pgIds }, status: 'OCCUPIED' });
      const maintenance = await Bed.countDocuments({ pg: { $in: pgIds }, status: 'MAINTENANCE' });

      return res.status(200).json({
        success: true,
        data: {
          totalBeds,
          available,
          reserved,
          occupied,
          maintenance,
        },
      });
    } else {
      const pgs = memoryPGs.filter(
        (p) => (p.owner === ownerId || p.owner?._id === ownerId || p.owner?.id === ownerId) && !p.isDeleted
      );
      const pgIds = pgs.map((p) => (p._id || p.id).toString());

      const beds = memoryBeds.filter((b) => pgIds.includes((b.pg?._id || b.pg?.id || b.pg).toString()));
      const totalBeds = beds.length;
      const available = beds.filter((b) => b.status === 'AVAILABLE').length;
      const reserved = beds.filter((b) => b.status === 'RESERVED').length;
      const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;
      const maintenance = beds.filter((b) => b.status === 'MAINTENANCE').length;

      return res.status(200).json({
        success: true,
        data: {
          totalBeds,
          available,
          reserved,
          occupied,
          maintenance,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single booking request details
 * @route   GET /api/bookings/:id
 * @access  Private (Seeker, Owner, Admin)
 */
const getBookingById = async (req, res, next) => {
  try {
    let booking;
    if (checkDBConnection()) {
      booking = await Booking.findById(req.params.id)
        .populate('pg')
        .populate('room')
        .populate('bed')
        .populate('seeker', 'name email mobile')
        .populate('owner', 'name email mobile');
    } else {
      booking = memoryBookings.find((b) => b._id === req.params.id || b.id === req.params.id);
    }

    if (!booking) return res.status(404).json({ success: false, message: 'Booking request not found.' });

    const callerId = req.user.id.toString();
    const seekerId = (booking.seeker?._id || booking.seeker?.id || booking.seeker).toString();
    const ownerId = (booking.owner?._id || booking.owner?.id || booking.owner).toString();

    if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this booking.' });
    }

    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Get platform bookings monitoring list
 * @route   GET /api/admin/bookings
 * @access  Private (ADMIN)
 */
const getAdminBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const total = await Booking.countDocuments(filter);
      const bookings = await Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('pg', 'name address')
        .populate('room', 'roomNumber roomType')
        .populate('bed', 'bedNumber')
        .populate('seeker', 'name email mobile')
        .populate('owner', 'name email mobile');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { bookings, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      let filtered = [...memoryBookings];
      if (status && status.trim() !== '') filtered = filtered.filter((b) => b.status === status.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { bookings: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  getMyBookings,
  getOwnerBookings,
  getOwnerOccupancy,
  getBookingById,
  getAdminBookings,
  memoryBookings,
};
