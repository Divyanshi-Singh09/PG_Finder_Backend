const PG = require('../models/PG');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Report = require('../models/Report');
const Complaint = require('../models/Complaint');
const PlatformSettings = require('../models/PlatformSettings');
const PGModerationLog = require('../models/PGModerationLog');
const VerificationAuditLog = require('../models/VerificationAuditLog');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const notificationService = require('../services/notificationService');

const memoryModerationLogs = [];
const memoryComplaints = [];
let memorySettings = {
  platformName: 'PGFinder',
  supportEmail: 'support@pgfinder.com',
  supportPhone: '+91 98765 43210',
  defaultSearchRadius: 10,
  reviewWindowDays: 30,
  autoApproveVerifiedOwners: false,
};

const recordModerationLog = async (pgId, adminId, action, previousStatus, newStatus, reason = '') => {
  if (checkDBConnection()) {
    await PGModerationLog.create({
      pg: pgId,
      admin: adminId,
      action,
      previousStatus,
      newStatus,
      reason,
    });
  } else {
    memoryModerationLogs.unshift({
      _id: `mod-log-${Date.now()}`,
      pg: pgId,
      admin: adminId,
      action,
      previousStatus,
      newStatus,
      reason,
      createdAt: new Date().toISOString(),
    });
  }
};

/**
 * @desc    Admin Dashboard Stats Summary
 * @route   GET /api/admin/stats
 * @access  Private (ADMIN)
 */
const getDashboardStats = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      const [
        users, owners, seekers, totalPGs, pendingPGs, approvedPGs, rejectedPGs, suspendedPGs,
        totalBookings, pendingBookings, activeBookings, pendingReports, openComplaints
      ] = await Promise.all([
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: 'OWNER', isActive: true }),
        User.countDocuments({ role: 'SEEKER', isActive: true }),
        PG.countDocuments({ isDeleted: false }),
        PG.countDocuments({ status: 'PENDING', isDeleted: false }),
        PG.countDocuments({ status: 'APPROVED', isDeleted: false }),
        PG.countDocuments({ status: 'REJECTED', isDeleted: false }),
        PG.countDocuments({ status: 'SUSPENDED', isDeleted: false }),
        Booking.countDocuments(),
        Booking.countDocuments({ status: 'PENDING' }),
        Booking.countDocuments({ status: 'ACCEPTED' }),
        Report.countDocuments({ status: 'PENDING' }),
        Complaint.countDocuments({ status: 'OPEN' }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          users, owners, seekers, totalPGs, pendingPGs, approvedPGs, rejectedPGs, suspendedPGs,
          totalBookings, pendingBookings, activeBookings, pendingReports, openComplaints,
        },
      });
    } else {
      const nonDeleted = memoryPGs.filter((p) => !p.isDeleted);
      const { memoryBookings } = require('./bookingController');
      return res.status(200).json({
        success: true,
        data: {
          users: 12, owners: 4, seekers: 8, totalPGs: nonDeleted.length,
          pendingPGs: nonDeleted.filter((p) => p.status === 'PENDING').length,
          approvedPGs: nonDeleted.filter((p) => p.status === 'APPROVED').length,
          rejectedPGs: nonDeleted.filter((p) => p.status === 'REJECTED').length,
          suspendedPGs: nonDeleted.filter((p) => p.status === 'SUSPENDED').length,
          totalBookings: (memoryBookings || []).length,
          pendingBookings: (memoryBookings || []).filter((b) => b.status === 'PENDING').length,
          activeBookings: (memoryBookings || []).filter((b) => b.status === 'ACCEPTED').length,
          pendingReports: 2, openComplaints: memoryComplaints.filter((c) => c.status === 'OPEN').length,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Users with Filters & Search
 * @route   GET /api/admin/users
 * @access  Private (ADMIN)
 */
const getUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (role && role.trim() !== '') filter.role = role.toUpperCase();
      if (status && status.trim() !== '') {
        if (status.toUpperCase() === 'ACTIVE') filter.isActive = true;
        else if (status.toUpperCase() === 'SUSPENDED') filter.isActive = false;
      }

      if (search && search.trim() !== '') {
        const sRegex = new RegExp(search.trim(), 'i');
        filter.$or = [{ name: sRegex }, { email: sRegex }, { mobile: sRegex }];
      }

      const total = await User.countDocuments(filter);
      const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { users, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      const mockUsers = [
        { _id: 'usr-mem-001', name: 'Aarav Patel', email: 'aarav@example.com', role: 'SEEKER', isActive: true, isVerified: true, createdAt: '2026-08-01' },
        { _id: 'usr-mem-002', name: 'Rajesh Sharma', email: 'rajesh@example.com', role: 'OWNER', isActive: true, isVerified: true, createdAt: '2026-07-25' },
        { _id: 'usr-mem-003', name: 'Platform Admin', email: 'admin@example.com', role: 'ADMIN', isActive: true, isVerified: true, createdAt: '2026-06-01' },
        { _id: 'usr-mem-004', name: 'Vikram Singh', email: 'vikram@example.com', role: 'SEEKER', isActive: false, isVerified: false, createdAt: '2026-08-05' },
      ];

      let filtered = [...mockUsers];
      if (role) filtered = filtered.filter((u) => u.role === role.toUpperCase());
      if (status) filtered = filtered.filter((u) => (status.toUpperCase() === 'ACTIVE' ? u.isActive : !u.isActive));
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
      }

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { users: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get User Details by ID for Admin
 * @route   GET /api/admin/users/:id
 * @access  Private (ADMIN)
 */
const getUserById = async (req, res, next) => {
  try {
    let user, pgs = [], bookings = [];
    if (checkDBConnection()) {
      user = await User.findById(req.params.id).select('-password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (user.role === 'OWNER') {
        pgs = await PG.find({ owner: user._id, isDeleted: false }).select('name status ratingSummary address');
      } else if (user.role === 'SEEKER') {
        bookings = await Booking.find({ seeker: user._id }).populate('pg', 'name');
      }
    } else {
      user = { _id: req.params.id, name: 'Aarav Patel', email: 'aarav@example.com', role: 'SEEKER', isActive: true, createdAt: '2026-08-01' };
    }

    res.status(200).json({
      success: true,
      data: { user, pgs, bookings },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspend or Reactivate User Account
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private (ADMIN)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    let { status, isActive, reason = '' } = req.body;

    if (isActive !== undefined) {
      status = isActive ? 'ACTIVE' : 'SUSPENDED';
    }

    if (!status || !['ACTIVE', 'SUSPENDED'].includes(String(status).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Status must be ACTIVE or SUSPENDED.' });
    }

    const newActiveState = String(status).toUpperCase() === 'ACTIVE';

    if (checkDBConnection()) {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      user.isActive = newActiveState;
      await user.save();

      await VerificationAuditLog.create({
        entityType: 'USER',
        entityId: user._id,
        action: newActiveState ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
        performedBy: adminId,
        reason: reason.trim(),
      });

      await notificationService.createNotification({
        recipient: user._id,
        type: 'VERIFICATION_UPDATE',
        title: newActiveState ? 'Account Activated' : 'Account Suspended',
        message: newActiveState ? 'Your account has been reactivated by platform admins.' : `Your account has been suspended: "${reason.trim()}"`,
        entityType: 'USER',
        entityId: user._id,
      });

      return res.status(200).json({ success: true, message: `User account ${newActiveState ? 'activated' : 'suspended'}.`, data: { user } });
    } else {
      return res.status(200).json({ success: true, message: `User account ${newActiveState ? 'activated' : 'suspended'}.` });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create User Complaint (Seeker/Owner)
 * @route   POST /api/complaints
 * @access  Private
 */
const createComplaint = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { pgId, bookingId, category, priority, subject, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Please provide subject and description.' });
    }

    if (checkDBConnection()) {
      const complaint = await Complaint.create({
        complainant: userId,
        pg: pgId || undefined,
        booking: bookingId || undefined,
        category: category || 'OTHER',
        priority: priority || 'MEDIUM',
        subject: subject.trim(),
        description: description.trim(),
        status: 'OPEN',
      });

      return res.status(201).json({ success: true, message: 'Complaint submitted successfully!', data: { complaint } });
    } else {
      const newC = {
        _id: `cmp-mem-${Date.now()}`,
        complainant: userId,
        complainantName: req.user.name,
        subject, description, category: category || 'OTHER', priority: priority || 'MEDIUM', status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      memoryComplaints.unshift(newC);
      return res.status(201).json({ success: true, message: 'Complaint submitted successfully!', data: { complaint: newC } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin Complaints Queue
 * @route   GET /api/admin/complaints
 * @access  Private (ADMIN)
 */
const getAdminComplaints = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status) filter.status = status.toUpperCase();
      if (priority) filter.priority = priority.toUpperCase();

      const total = await Complaint.countDocuments(filter);
      const complaints = await Complaint.find(filter)
        .populate('complainant', 'name email role')
        .populate('pg', 'name address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.status(200).json({ success: true, data: { complaints, pagination: { page: pageNum, limit: limitNum, total, totalPages } } });
    } else {
      let filtered = [...memoryComplaints];
      if (status) filtered = filtered.filter((c) => c.status === status.toUpperCase());
      if (priority) filtered = filtered.filter((c) => c.priority === priority.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.status(200).json({ success: true, data: { complaints: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin Update Complaint Status & Notes
 * @route   PATCH /api/admin/complaints/:id/status
 * @access  Private (ADMIN)
 */
const updateComplaintStatus = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status, adminNotes = '', resolutionReason = '' } = req.body;

    if (checkDBConnection()) {
      const complaint = await Complaint.findById(req.params.id);
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

      if (status) complaint.status = status.toUpperCase();
      if (adminNotes) complaint.adminNotes = adminNotes.trim();
      if (resolutionReason) complaint.resolutionReason = resolutionReason.trim();
      if (status.toUpperCase() === 'RESOLVED') complaint.resolvedAt = new Date();
      complaint.assignedAdmin = adminId;

      await complaint.save();

      await notificationService.createNotification({
        recipient: complaint.complainant,
        type: 'VERIFICATION_UPDATE',
        title: 'Support Ticket Update',
        message: `Your complaint "${complaint.subject}" is now ${complaint.status}.`,
        entityType: 'COMPLAINT',
        entityId: complaint._id,
      });

      return res.status(200).json({ success: true, message: 'Complaint status updated.', data: { complaint } });
    } else {
      const cmp = memoryComplaints.find((c) => c._id === req.params.id || c.id === req.params.id);
      if (cmp) {
        if (status) cmp.status = status.toUpperCase();
        if (adminNotes) cmp.adminNotes = adminNotes.trim();
      }
      return res.status(200).json({ success: true, message: 'Complaint status updated.', data: { complaint: cmp } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Platform Analytics Data
 * @route   GET /api/admin/analytics
 * @access  Private (ADMIN)
 */
const getPlatformAnalytics = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      const [totalUsers, totalPGs, totalBookings, totalReviews, avgRatingObj] = await Promise.all([
        User.countDocuments(),
        PG.countDocuments({ isDeleted: false }),
        Booking.countDocuments(),
        Review.countDocuments({ status: 'PUBLISHED' }),
        Review.aggregate([{ $match: { status: 'PUBLISHED' } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
      ]);

      const avgPlatformRating = avgRatingObj.length > 0 ? parseFloat(avgRatingObj[0].avg.toFixed(1)) : 4.5;

      return res.status(200).json({
        success: true,
        data: {
          metrics: {
            totalUsers,
            totalPGs,
            totalBookings,
            totalReviews,
            avgPlatformRating,
          },
          growth: [
            { period: 'May 2026', users: 450, pgs: 120, bookings: 310 },
            { period: 'Jun 2026', users: 820, pgs: 240, bookings: 590 },
            { period: 'Jul 2026', users: 1240, pgs: 410, bookings: 890 },
            { period: 'Aug 2026', users: 1890, pgs: 650, bookings: 1320 },
          ],
        },
      });
    } else {
      return res.status(200).json({
        success: true,
        data: {
          metrics: {
            totalUsers: 1240,
            totalPGs: 285,
            totalBookings: 890,
            totalReviews: 420,
            avgPlatformRating: 4.6,
          },
          growth: [
            { period: 'May 2026', users: 450, pgs: 120, bookings: 310 },
            { period: 'Jun 2026', users: 820, pgs: 240, bookings: 590 },
            { period: 'Jul 2026', users: 1240, pgs: 410, bookings: 890 },
            { period: 'Aug 2026', users: 1890, pgs: 650, bookings: 1320 },
          ],
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Platform Activity & Audit Logs
 * @route   GET /api/admin/activity-logs
 * @access  Private (ADMIN)
 */
const getActivityLogs = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      const logs = await VerificationAuditLog.find()
        .populate('performedBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(50);
      return res.status(200).json({ success: true, data: { logs } });
    } else {
      return res.status(200).json({
        success: true,
        data: {
          logs: [
            { _id: 'log-1', action: 'PG_APPROVED', performedBy: { name: 'Admin' }, reason: 'Verified property documentation', createdAt: new Date().toISOString() },
            { _id: 'log-2', action: 'USER_SUSPENDED', performedBy: { name: 'Admin' }, reason: 'Policy violation', createdAt: new Date(Date.now() - 3600000).toISOString() },
          ],
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get / Update Platform Settings
 * @route   GET /api/admin/settings & PATCH /api/admin/settings
 * @access  Private (ADMIN)
 */
const getPlatformSettings = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      let settings = await PlatformSettings.findOne();
      if (!settings) settings = await PlatformSettings.create({});
      return res.status(200).json({ success: true, data: { settings } });
    } else {
      return res.status(200).json({ success: true, data: { settings: memorySettings } });
    }
  } catch (error) {
    next(error);
  }
};

const updatePlatformSettings = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      let settings = await PlatformSettings.findOne();
      if (!settings) settings = new PlatformSettings();
      Object.assign(settings, req.body);
      await settings.save();
      return res.status(200).json({ success: true, message: 'Platform settings updated.', data: { settings } });
    } else {
      memorySettings = { ...memorySettings, ...req.body };
      return res.status(200).json({ success: true, message: 'Platform settings updated.', data: { settings: memorySettings } });
    }
  } catch (error) {
    next(error);
  }
};

// Existing PG approval/rejection methods preserved
const getPGs = async (req, res, next) => {
  try {
    const { status, city, pgType, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = { isDeleted: false };
      if (status && status.trim() !== '') filter.status = status.toUpperCase();
      if (city && city.trim() !== '') filter['address.city'] = new RegExp(city.trim(), 'i');
      if (pgType && pgType.trim() !== '') filter.pgType = pgType.toUpperCase();

      if (search && search.trim() !== '') {
        const sRegex = new RegExp(search.trim(), 'i');
        filter.$or = [{ name: sRegex }, { 'address.city': sRegex }, { 'address.locality': sRegex }];
      }

      const total = await PG.countDocuments(filter);
      const pgs = await PG.find(filter).populate('owner', 'name email mobile isVerifiedOwner').sort({ createdAt: -1 }).skip(skip).limit(limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({ success: true, data: { pgs, pagination: { page: pageNum, limit: limitNum, total, totalPages } } });
    } else {
      let filtered = memoryPGs.filter((p) => !p.isDeleted);
      if (status && status.trim() !== '') filtered = filtered.filter((p) => p.status === status.toUpperCase());
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.status(200).json({ success: true, data: { pgs: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } } });
    }
  } catch (error) {
    next(error);
  }
};

const getPGDetailsForReview = async (req, res, next) => {
  try {
    let pg, moderationLogs = [];
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, isDeleted: false }).populate('owner', 'name email mobile isVerifiedOwner');
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      moderationLogs = await PGModerationLog.find({ pg: pg._id }).populate('admin', 'name email').sort({ createdAt: -1 });
    } else {
      pg = memoryPGs.find((p) => (p._id === req.params.id || p.id === req.params.id) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      moderationLogs = memoryModerationLogs.filter((l) => l.pg === req.params.id);
    }
    res.status(200).json({ success: true, data: { pg, moderationLogs } });
  } catch (error) {
    next(error);
  }
};

const approvePG = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, isDeleted: false });
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      const prev = pg.status;
      pg.status = 'APPROVED';
      pg.rejectionReason = '';
      await pg.save();
      await recordModerationLog(pg._id, adminId, 'APPROVE', prev, 'APPROVED');
    } else {
      pg = memoryPGs.find((p) => (p._id === req.params.id || p.id === req.params.id) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      pg.status = 'APPROVED';
      pg.rejectionReason = '';
      await recordModerationLog(req.params.id, adminId, 'APPROVE', 'PENDING', 'APPROVED');
    }

    res.status(200).json({ success: true, message: 'PG property approved successfully!', data: { pg } });
  } catch (error) {
    next(error);
  }
};

const rejectPG = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { rejectionReason } = req.body;
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Please provide a valid rejection reason.' });
    }

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, isDeleted: false });
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      const prev = pg.status;
      pg.status = 'REJECTED';
      pg.rejectionReason = rejectionReason.trim();
      await pg.save();
      await recordModerationLog(pg._id, adminId, 'REJECT', prev, 'REJECTED', rejectionReason.trim());
    } else {
      pg = memoryPGs.find((p) => (p._id === req.params.id || p.id === req.params.id) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      pg.status = 'REJECTED';
      pg.rejectionReason = rejectionReason.trim();
      await recordModerationLog(req.params.id, adminId, 'REJECT', 'PENDING', 'REJECTED', rejectionReason.trim());
    }

    res.status(200).json({ success: true, message: 'PG property rejected.', data: { pg } });
  } catch (error) {
    next(error);
  }
};

const suspendPG = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { suspensionReason } = req.body;

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, isDeleted: false });
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      const prev = pg.status;
      pg.status = 'SUSPENDED';
      pg.verificationStatus = 'SUSPENDED';
      await pg.save();
      await recordModerationLog(pg._id, adminId, 'SUSPEND', prev, 'SUSPENDED', suspensionReason || '');
    } else {
      pg = memoryPGs.find((p) => (p._id === req.params.id || p.id === req.params.id) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      pg.status = 'SUSPENDED';
      pg.verificationStatus = 'SUSPENDED';
    }

    res.status(200).json({ success: true, message: 'PG listing suspended.', data: { pg } });
  } catch (error) {
    next(error);
  }
};

const reactivatePG = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, isDeleted: false });
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      const prev = pg.status;
      pg.status = 'APPROVED';
      pg.verificationStatus = 'VERIFIED';
      await pg.save();
      await recordModerationLog(pg._id, adminId, 'REACTIVATE', prev, 'APPROVED');
    } else {
      pg = memoryPGs.find((p) => (p._id === req.params.id || p.id === req.params.id) && !p.isDeleted);
      if (!pg) return res.status(404).json({ success: false, message: 'PG property not found' });
      pg.status = 'APPROVED';
      pg.verificationStatus = 'VERIFIED';
    }

    res.status(200).json({ success: true, message: 'PG listing reactivated.', data: { pg } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Global Admin Search
 * @route   GET /api/admin/search
 * @access  Private (ADMIN)
 */
const globalAdminSearch = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.status(200).json({ success: true, data: { users: [], pgs: [] } });
    }

    const regex = new RegExp(q.trim(), 'i');

    if (checkDBConnection()) {
      const [users, pgs] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] }).limit(10).select('-password'),
        PG.find({ $or: [{ name: regex }, { 'address.city': regex }, { 'address.area': regex }] }).limit(10),
      ]);

      return res.status(200).json({ success: true, data: { users, pgs } });
    } else {
      const { memoryUsers } = require('./authController');
      const matchedUsers = (memoryUsers || []).filter(
        (u) => regex.test(u.name) || regex.test(u.email) || regex.test(u.phone || '')
      ).slice(0, 10);

      const matchedPGs = (memoryPGs || []).filter(
        (p) => !p.isDeleted && (regex.test(p.name) || regex.test(p.address?.city || '') || regex.test(p.address?.area || ''))
      ).slice(0, 10);

      return res.status(200).json({ success: true, data: { users: matchedUsers, pgs: matchedPGs } });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getPGs,
  getPGDetailsForReview,
  approvePG,
  rejectPG,
  suspendPG,
  reactivatePG,
  getUsers,
  getUserById,
  updateUserStatus,
  createComplaint,
  getAdminComplaints,
  updateComplaintStatus,
  getPlatformAnalytics,
  getActivityLogs,
  getPlatformSettings,
  updatePlatformSettings,
  globalAdminSearch,
};
