const Enquiry = require('../models/Enquiry');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const notificationService = require('../services/notificationService');

// Memory store fallback for enquiries in local dev
const memoryEnquiries = [];

/**
 * @desc    Create a new enquiry (Seeker -> Owner)
 * @route   POST /api/enquiries
 * @access  Private (SEEKER)
 */
const createEnquiry = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId, subject, message } = req.body;

    if (!pgId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PG ID, subject, and message.',
      });
    }

    if (subject.trim().length === 0 || message.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 5 characters long.',
      });
    }

    let pg;
    let ownerId;

    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: pgId, isDeleted: false });
      if (!pg) {
        return res.status(404).json({ success: false, message: 'PG property listing not found.' });
      }
      if (pg.status === 'SUSPENDED' || pg.verificationStatus === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept new enquiries.',
        });
      }
      if (pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Enquiries can only be submitted for approved property listings.',
        });
      }
      ownerId = pg.owner;
    } else {
      pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
      if (!pg) {
        return res.status(404).json({ success: false, message: 'PG property listing not found.' });
      }
      if (pg.status === 'SUSPENDED' || pg.verificationStatus === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          message: 'This property listing is currently suspended and cannot accept new enquiries.',
        });
      }
      if (pg.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Enquiries can only be submitted for approved property listings.',
        });
      }
      ownerId = pg.owner;
    }

    let enquiry;
    if (checkDBConnection()) {
      enquiry = await Enquiry.create({
        seeker: seekerId,
        owner: ownerId,
        pg: pgId,
        subject: subject.trim(),
        message: message.trim(),
        status: 'PENDING',
      });
    } else {
      enquiry = {
        _id: `enq-mem-${Date.now()}`,
        id: `enq-mem-${Date.now()}`,
        seeker: seekerId,
        owner: ownerId,
        pg: pgId,
        subject: subject.trim(),
        message: message.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryEnquiries.unshift(enquiry);
    }

    // Send Event Notification to Owner
    await notificationService.createNotification({
      recipient: ownerId,
      type: 'ENQUIRY_RECEIVED',
      title: 'New Seeker Enquiry',
      message: `${req.user.name} sent an enquiry for "${pg.name}": "${subject.trim()}"`,
      entityType: 'ENQUIRY',
      entityId: enquiry._id || enquiry.id,
      actionUrl: '/owner/enquiries',
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully! The owner will be notified.',
      data: { enquiry },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get seeker's submitted enquiries
 * @route   GET /api/enquiries/my
 * @access  Private (SEEKER)
 */
const getMyEnquiries = async (req, res, next) => {
  try {
    const seekerId = req.user.id;

    if (checkDBConnection()) {
      const enquiries = await Enquiry.find({ seeker: seekerId })
        .sort({ createdAt: -1 })
        .populate('pg', 'name address location rent images')
        .populate('owner', 'name email mobile');

      return res.status(200).json({
        success: true,
        data: { enquiries },
      });
    } else {
      const filtered = memoryEnquiries.filter(
        (e) => e.seeker === seekerId || e.seeker?._id === seekerId || e.seeker?.id === seekerId
      );
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.status(200).json({
        success: true,
        data: { enquiries: filtered },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's received enquiries across their PGs
 * @route   GET /api/enquiries/owner
 * @access  Private (OWNER)
 */
const getOwnerEnquiries = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const enquiries = await Enquiry.find({ owner: ownerId })
        .sort({ createdAt: -1 })
        .populate('pg', 'name address location')
        .populate('seeker', 'name email mobile');

      return res.status(200).json({
        success: true,
        data: { enquiries },
      });
    } else {
      const filtered = memoryEnquiries.filter(
        (e) => e.owner === ownerId || e.owner?._id === ownerId || e.owner?.id === ownerId
      );
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.status(200).json({
        success: true,
        data: { enquiries: filtered },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single enquiry details
 * @route   GET /api/enquiries/:id
 * @access  Private (Seeker or Owner or Admin)
 */
const getEnquiryById = async (req, res, next) => {
  try {
    let enquiry;

    if (checkDBConnection()) {
      enquiry = await Enquiry.findById(req.params.id)
        .populate('pg')
        .populate('seeker', 'name email mobile')
        .populate('owner', 'name email mobile');
    } else {
      enquiry = memoryEnquiries.find((e) => e._id === req.params.id || e.id === req.params.id);
    }

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }

    const callerId = req.user.id.toString();
    const seekerId = (enquiry.seeker?._id || enquiry.seeker?.id || enquiry.seeker).toString();
    const ownerId = (enquiry.owner?._id || enquiry.owner?.id || enquiry.owner).toString();

    if (req.user.role !== 'ADMIN' && callerId !== seekerId && callerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this enquiry.',
      });
    }

    res.status(200).json({
      success: true,
      data: { enquiry },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Owner responds to an enquiry
 * @route   PATCH /api/enquiries/owner/:id/respond
 * @access  Private (OWNER)
 */
const respondToEnquiry = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { response, status } = req.body;

    if (!response || response.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid response message.',
      });
    }

    let enquiry;

    if (checkDBConnection()) {
      enquiry = await Enquiry.findById(req.params.id);
      if (!enquiry) {
        return res.status(404).json({ success: false, message: 'Enquiry not found.' });
      }

      if (req.user.role !== 'ADMIN' && enquiry.owner.toString() !== ownerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to respond to this enquiry.',
        });
      }

      enquiry.ownerResponse = response.trim();
      enquiry.respondedAt = new Date();
      enquiry.status = status && ['RESPONDED', 'CLOSED'].includes(status.toUpperCase()) ? status.toUpperCase() : 'RESPONDED';

      await enquiry.save();

      // Notify Seeker of owner's response
      await notificationService.createNotification({
        recipient: enquiry.seeker,
        type: 'ENQUIRY_REPLIED',
        title: 'New Response to Your Enquiry',
        message: `Owner responded to your enquiry "${enquiry.subject}": "${response.trim()}"`,
        entityType: 'ENQUIRY',
        entityId: enquiry._id,
        actionUrl: '/seeker/enquiries',
      });

      return res.status(200).json({
        success: true,
        message: 'Response sent to seeker successfully.',
        data: { enquiry },
      });
    } else {
      enquiry = memoryEnquiries.find((e) => e._id === req.params.id || e.id === req.params.id);
      if (!enquiry) {
        return res.status(404).json({ success: false, message: 'Enquiry not found.' });
      }

      const actualOwnerId = (enquiry.owner?._id || enquiry.owner?.id || enquiry.owner).toString();
      if (req.user.role !== 'ADMIN' && actualOwnerId !== ownerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to respond to this enquiry.',
        });
      }

      enquiry.ownerResponse = response.trim();
      enquiry.respondedAt = new Date().toISOString();
      enquiry.status = status && ['RESPONDED', 'CLOSED'].includes(status.toUpperCase()) ? status.toUpperCase() : 'RESPONDED';

      const seekerId = (enquiry.seeker?._id || enquiry.seeker?.id || enquiry.seeker).toString();
      await notificationService.createNotification({
        recipient: seekerId,
        type: 'ENQUIRY_REPLIED',
        title: 'New Response to Your Enquiry',
        message: `Owner responded to your enquiry "${enquiry.subject}": "${response.trim()}"`,
        entityType: 'ENQUIRY',
        entityId: enquiry._id || enquiry.id,
        actionUrl: '/seeker/enquiries',
      });

      return res.status(200).json({
        success: true,
        message: 'Response sent to seeker successfully.',
        data: { enquiry },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Seeker closes an enquiry
 * @route   PATCH /api/enquiries/:id/close
 * @access  Private (SEEKER)
 */
const closeEnquiry = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    let enquiry;

    if (checkDBConnection()) {
      enquiry = await Enquiry.findById(req.params.id);
      if (!enquiry) {
        return res.status(404).json({ success: false, message: 'Enquiry not found.' });
      }

      if (enquiry.seeker.toString() !== seekerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to close this enquiry.',
        });
      }

      enquiry.status = 'CLOSED';
      await enquiry.save();

      return res.status(200).json({
        success: true,
        message: 'Enquiry marked as closed.',
        data: { enquiry },
      });
    } else {
      enquiry = memoryEnquiries.find((e) => e._id === req.params.id || e.id === req.params.id);
      if (!enquiry) {
        return res.status(404).json({ success: false, message: 'Enquiry not found.' });
      }

      const actualSeekerId = (enquiry.seeker?._id || enquiry.seeker?.id || enquiry.seeker).toString();
      if (actualSeekerId !== seekerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to close this enquiry.',
        });
      }

      enquiry.status = 'CLOSED';
      return res.status(200).json({
        success: true,
        message: 'Enquiry marked as closed.',
        data: { enquiry },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEnquiry,
  getMyEnquiries,
  getOwnerEnquiries,
  getEnquiryById,
  respondToEnquiry,
  closeEnquiry,
  memoryEnquiries,
};
