const OwnerVerification = require('../models/OwnerVerification');
const PG = require('../models/PG');
const User = require('../models/User');
const VerificationAuditLog = require('../models/VerificationAuditLog');
const { checkDBConnection } = require('../config/db');
const { uploadPrivateDocument } = require('../services/fileStorageService');
const notificationService = require('../services/notificationService');

// Memory fallback store for local dev
const memoryOwnerVerifications = [];
const memoryAuditLogs = [];

/**
 * Record a verification audit log entry
 */
const recordAuditLog = async (entityType, entityId, action, performedBy, reason = '') => {
  if (checkDBConnection()) {
    await VerificationAuditLog.create({
      entityType,
      entityId,
      action,
      performedBy,
      reason,
    });
  } else {
    memoryAuditLogs.unshift({
      _id: `log-mem-${Date.now()}`,
      entityType,
      entityId,
      action,
      performedBy,
      reason,
      createdAt: new Date().toISOString(),
    });
  }
};

/**
 * @desc    Upload document for owner verification
 * @route   POST /api/verification/owner/upload
 * @access  Private (OWNER)
 */
const uploadDocument = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { docType, fileData, fileName } = req.body;

    if (!docType || !fileData) {
      return res.status(400).json({
        success: false,
        message: 'Please provide document type and file data.',
      });
    }

    const uploadRes = await uploadPrivateDocument(fileData, docType);

    if (checkDBConnection()) {
      let record = await OwnerVerification.findOne({ owner: ownerId });
      if (!record) {
        record = new OwnerVerification({
          owner: ownerId,
          fullName: req.user.name,
          phone: req.user.mobile || '',
          verificationStatus: 'DRAFT',
          documents: [],
        });
      }

      // Replace existing document of same type or add new
      const existingIdx = record.documents.findIndex((d) => d.type === docType);
      const newDocObj = {
        type: docType,
        fileUrl: uploadRes.fileUrl,
        fileName: fileName || `${docType}.png`,
        uploadedAt: new Date(),
      };

      if (existingIdx !== -1) {
        record.documents[existingIdx] = newDocObj;
      } else {
        record.documents.push(newDocObj);
      }

      await record.save();

      return res.status(200).json({
        success: true,
        message: 'Document uploaded successfully.',
        data: { document: newDocObj },
      });
    } else {
      let record = memoryOwnerVerifications.find((v) => v.owner === ownerId || v.owner?.id === ownerId);
      if (!record) {
        record = {
          _id: `ver-mem-${Date.now()}`,
          id: `ver-mem-${Date.now()}`,
          owner: ownerId,
          fullName: req.user.name,
          phone: req.user.mobile || '',
          verificationStatus: 'DRAFT',
          documents: [],
          createdAt: new Date().toISOString(),
        };
        memoryOwnerVerifications.unshift(record);
      }

      const existingIdx = record.documents.findIndex((d) => d.type === docType);
      const newDocObj = {
        type: docType,
        fileUrl: uploadRes.fileUrl,
        fileName: fileName || `${docType}.png`,
        uploadedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        record.documents[existingIdx] = newDocObj;
      } else {
        record.documents.push(newDocObj);
      }

      return res.status(200).json({
        success: true,
        message: 'Document uploaded successfully.',
        data: { document: newDocObj },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit owner verification package for admin review
 * @route   POST /api/verification/owner/submit
 * @access  Private (OWNER)
 */
const submitVerification = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { fullName, phone } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your full legal name and contact phone number.',
      });
    }

    if (checkDBConnection()) {
      const record = await OwnerVerification.findOne({ owner: ownerId });
      if (!record || record.documents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'You must upload at least one identity document before submitting verification.',
        });
      }

      record.fullName = fullName.trim();
      record.phone = phone.trim();
      record.verificationStatus = 'SUBMITTED';
      record.submittedAt = new Date();
      await record.save();

      await User.findByIdAndUpdate(ownerId, { verificationStatus: 'SUBMITTED' });
      await recordAuditLog('OWNER_VERIFICATION', record._id, 'SUBMITTED', ownerId);

      return res.status(200).json({
        success: true,
        message: 'Verification submitted successfully! Our team will review your documents.',
        data: { record },
      });
    } else {
      let record = memoryOwnerVerifications.find((v) => v.owner === ownerId || v.owner?.id === ownerId);
      if (!record || record.documents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'You must upload at least one identity document before submitting verification.',
        });
      }

      record.fullName = fullName.trim();
      record.phone = phone.trim();
      record.verificationStatus = 'SUBMITTED';
      record.submittedAt = new Date().toISOString();

      await recordAuditLog('OWNER_VERIFICATION', record._id || record.id, 'SUBMITTED', ownerId);

      return res.status(200).json({
        success: true,
        message: 'Verification submitted successfully! Our team will review your documents.',
        data: { record },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get owner's verification status
 * @route   GET /api/verification/owner/status
 * @access  Private (OWNER)
 */
const getVerificationStatus = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const record = await OwnerVerification.findOne({ owner: ownerId });
      return res.status(200).json({
        success: true,
        data: { record: record || { verificationStatus: 'NOT_STARTED', documents: [] } },
      });
    } else {
      const record = memoryOwnerVerifications.find((v) => v.owner === ownerId || v.owner?.id === ownerId);
      return res.status(200).json({
        success: true,
        data: { record: record || { verificationStatus: 'NOT_STARTED', documents: [] } },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get private document stream (Owner or Admin only)
 * @route   GET /api/verification/document/:id
 * @access  Private (Owner/Admin)
 */
const getPrivateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    // In production, verifies JWT and streams private file contents or returns signed URL
    return res.status(200).json({
      success: true,
      message: 'Private verification document access granted.',
      data: { documentId: id, accessGranted: true },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Get owner verifications list
 * @route   GET /api/admin/owner-verifications
 * @access  Private (ADMIN)
 */
const getAdminOwnerVerifications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status && status.trim() !== '') filter.verificationStatus = status.toUpperCase();

      const total = await OwnerVerification.countDocuments(filter);
      const records = await OwnerVerification.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('owner', 'name email mobile createdAt');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { records, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      let filtered = [...memoryOwnerVerifications];
      if (status && status.trim() !== '') filtered = filtered.filter((v) => v.verificationStatus === status.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { records: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Approve owner verification
 * @route   PATCH /api/admin/owner-verifications/:id/approve
 * @access  Private (ADMIN)
 */
const approveOwnerVerification = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    let record;
    if (checkDBConnection()) {
      record = await OwnerVerification.findById(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: 'Verification record not found.' });

      record.verificationStatus = 'APPROVED';
      record.reviewedAt = new Date();
      record.reviewedBy = adminId;
      record.rejectionReason = '';
      await record.save();

      await User.findByIdAndUpdate(record.owner, { isVerifiedOwner: true, verificationStatus: 'APPROVED' });
      await recordAuditLog('OWNER_VERIFICATION', record._id, 'APPROVED', adminId);

      // Send Event Notification to Owner
      await notificationService.createNotification({
        recipient: record.owner,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Owner Verification Approved!',
        message: 'Your identity & ownership verification has been approved. The "Verified Owner" badge is now live on your profile.',
        entityType: 'USER',
        entityId: record.owner,
      });

      return res.status(200).json({
        success: true,
        message: 'Owner verification approved successfully.',
        data: { record },
      });
    } else {
      record = memoryOwnerVerifications.find((v) => v._id === req.params.id || v.id === req.params.id);
      if (!record) return res.status(404).json({ success: false, message: 'Verification record not found.' });

      record.verificationStatus = 'APPROVED';
      record.reviewedAt = new Date().toISOString();
      record.reviewedBy = adminId;

      await recordAuditLog('OWNER_VERIFICATION', record._id || record.id, 'APPROVED', adminId);

      const ownerId = record.owner?._id || record.owner?.id || record.owner;
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Owner Verification Approved!',
        message: 'Your identity & ownership verification has been approved. The "Verified Owner" badge is now live on your profile.',
        entityType: 'USER',
        entityId: ownerId,
      });

      return res.status(200).json({
        success: true,
        message: 'Owner verification approved successfully.',
        data: { record },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Reject owner verification
 * @route   PATCH /api/admin/owner-verifications/:id/reject
 * @access  Private (ADMIN)
 */
const rejectOwnerVerification = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason = '' } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Please provide a rejection reason.' });
    }

    let record;
    if (checkDBConnection()) {
      record = await OwnerVerification.findById(req.params.id);
      if (!record) return res.status(404).json({ success: false, message: 'Verification record not found.' });

      record.verificationStatus = 'REJECTED';
      record.reviewedAt = new Date();
      record.reviewedBy = adminId;
      record.rejectionReason = reason.trim();
      await record.save();

      await User.findByIdAndUpdate(record.owner, { isVerifiedOwner: false, verificationStatus: 'REJECTED' });
      await recordAuditLog('OWNER_VERIFICATION', record._id, 'REJECTED', adminId, reason.trim());

      await notificationService.createNotification({
        recipient: record.owner,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Owner Verification Rejection',
        message: `Your verification could not be approved. Reason: ${reason.trim()}`,
        entityType: 'USER',
        entityId: record.owner,
      });

      return res.status(200).json({
        success: true,
        message: 'Owner verification rejected.',
        data: { record },
      });
    } else {
      record = memoryOwnerVerifications.find((v) => v._id === req.params.id || v.id === req.params.id);
      if (!record) return res.status(404).json({ success: false, message: 'Verification record not found.' });

      record.verificationStatus = 'REJECTED';
      record.rejectionReason = reason.trim();
      record.reviewedAt = new Date().toISOString();

      await recordAuditLog('OWNER_VERIFICATION', record._id || record.id, 'REJECTED', adminId, reason.trim());

      const ownerId = record.owner?._id || record.owner?.id || record.owner;
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Owner Verification Rejection',
        message: `Your verification could not be approved. Reason: ${reason.trim()}`,
        entityType: 'USER',
        entityId: ownerId,
      });

      return res.status(200).json({
        success: true,
        message: 'Owner verification rejected.',
        data: { record },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Suspend a PG listing
 * @route   PATCH /api/admin/pgs/:id/suspend
 * @access  Private (ADMIN)
 */
const suspendPG = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason = '' } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Please provide a suspension reason.' });
    }

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findById(req.params.id);
      if (!pg) return res.status(404).json({ success: false, message: 'PG listing not found.' });

      pg.status = 'SUSPENDED';
      pg.verificationStatus = 'SUSPENDED';
      pg.suspensionReason = reason.trim();
      pg.suspendedAt = new Date();
      pg.suspendedBy = adminId;
      await pg.save();

      await recordAuditLog('PG_VERIFICATION', pg._id, 'SUSPENDED', adminId, reason.trim());

      await notificationService.createNotification({
        recipient: pg.owner,
        type: 'PG_REJECTED',
        title: 'PG Property Listing Suspended',
        message: `Your property listing "${pg.name}" has been suspended by administration. Reason: ${reason.trim()}`,
        entityType: 'PG',
        entityId: pg._id,
      });

      return res.status(200).json({
        success: true,
        message: 'PG listing suspended successfully.',
        data: { pg },
      });
    } else {
      const { memoryPGs } = require('./pgController');
      pg = memoryPGs.find((p) => p._id === req.params.id || p.id === req.params.id);
      if (!pg) return res.status(404).json({ success: false, message: 'PG listing not found.' });

      pg.status = 'SUSPENDED';
      pg.verificationStatus = 'SUSPENDED';
      pg.suspensionReason = reason.trim();

      await recordAuditLog('PG_VERIFICATION', pg._id || pg.id, 'SUSPENDED', adminId, reason.trim());

      const ownerId = pg.owner?._id || pg.owner?.id || pg.owner;
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'PG_REJECTED',
        title: 'PG Property Listing Suspended',
        message: `Your property listing "${pg.name}" has been suspended by administration. Reason: ${reason.trim()}`,
        entityType: 'PG',
        entityId: pg._id || pg.id,
      });

      return res.status(200).json({
        success: true,
        message: 'PG listing suspended successfully.',
        data: { pg },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Unsuspend a PG listing
 * @route   PATCH /api/admin/pgs/:id/unsuspend
 * @access  Private (ADMIN)
 */
const unsuspendPG = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findById(req.params.id);
      if (!pg) return res.status(404).json({ success: false, message: 'PG listing not found.' });

      pg.status = 'APPROVED';
      pg.verificationStatus = 'APPROVED';
      pg.suspensionReason = '';
      await pg.save();

      await recordAuditLog('PG_VERIFICATION', pg._id, 'UNSUSPENDED', adminId);

      await notificationService.createNotification({
        recipient: pg.owner,
        type: 'PG_APPROVED',
        title: 'PG Property Listing Reactivated',
        message: `Your property listing "${pg.name}" has been unsuspended and is live again for seekers.`,
        entityType: 'PG',
        entityId: pg._id,
      });

      return res.status(200).json({
        success: true,
        message: 'PG listing unsuspended and reactivated.',
        data: { pg },
      });
    } else {
      const { memoryPGs } = require('./pgController');
      pg = memoryPGs.find((p) => p._id === req.params.id || p.id === req.params.id);
      if (!pg) return res.status(404).json({ success: false, message: 'PG listing not found.' });

      pg.status = 'APPROVED';
      pg.verificationStatus = 'APPROVED';
      pg.suspensionReason = '';

      await recordAuditLog('PG_VERIFICATION', pg._id || pg.id, 'UNSUSPENDED', adminId);

      const ownerId = pg.owner?._id || pg.owner?.id || pg.owner;
      await notificationService.createNotification({
        recipient: ownerId,
        type: 'PG_APPROVED',
        title: 'PG Property Listing Reactivated',
        message: `Your property listing "${pg.name}" has been unsuspended and is live again for seekers.`,
        entityType: 'PG',
        entityId: pg._id || pg.id,
      });

      return res.status(200).json({
        success: true,
        message: 'PG listing unsuspended and reactivated.',
        data: { pg },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  submitVerification,
  getVerificationStatus,
  getPrivateDocument,
  getAdminOwnerVerifications,
  approveOwnerVerification,
  rejectOwnerVerification,
  suspendPG,
  unsuspendPG,
  memoryOwnerVerifications,
  memoryAuditLogs,
};
