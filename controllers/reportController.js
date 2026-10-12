const Report = require('../models/Report');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const notificationService = require('../services/notificationService');

// Memory store fallback for reports in local dev
const memoryReports = [];

/**
 * @desc    Submit a report against a PG property listing
 * @route   POST /api/reports
 * @access  Private (Seeker, User)
 */
const createReport = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const { pgId, reason, description } = req.body;

    if (!pgId || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PG ID, report reason, and detailed description.',
      });
    }

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findById(pgId);
      if (!pg) return res.status(404).json({ success: false, message: 'Reported PG listing not found.' });

      // Duplicate open report check
      const existing = await Report.findOne({
        reporter: reporterId,
        targetId: pgId,
        status: { $in: ['OPEN', 'UNDER_REVIEW'] },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted an active report for this property. Our team is investigating.',
        });
      }

      const report = await Report.create({
        reporter: reporterId,
        targetType: 'PG',
        targetId: pgId,
        reason: reason.trim(),
        description: description.trim(),
        status: 'OPEN',
      });

      return res.status(201).json({
        success: true,
        message: 'Report submitted successfully! Thank you for helping keep PGFinder safe.',
        data: { report },
      });
    } else {
      pg = memoryPGs.find((p) => p._id === pgId || p.id === pgId);
      if (!pg) return res.status(404).json({ success: false, message: 'Reported PG listing not found.' });

      const existing = memoryReports.find(
        (r) => (r.reporter === reporterId || r.reporter?.id === reporterId) &&
               (r.targetId === pgId || r.targetId?._id === pgId) &&
               ['OPEN', 'UNDER_REVIEW'].includes(r.status)
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted an active report for this property. Our team is investigating.',
        });
      }

      const newReport = {
        _id: `rep-mem-${Date.now()}`,
        id: `rep-mem-${Date.now()}`,
        reporter: reporterId,
        targetType: 'PG',
        targetId: pg,
        reason: reason.trim(),
        description: description.trim(),
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };

      memoryReports.unshift(newReport);

      return res.status(201).json({
        success: true,
        message: 'Report submitted successfully! Thank you for helping keep PGFinder safe.',
        data: { report: newReport },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Get list of user flag reports
 * @route   GET /api/admin/reports
 * @access  Private (ADMIN)
 */
const getAdminReports = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const filter = {};
      if (status && status.trim() !== '') filter.status = status.toUpperCase();

      const total = await Report.countDocuments(filter);
      const reports = await Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('reporter', 'name email mobile')
        .populate('targetId', 'name address owner');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { reports, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    } else {
      let filtered = [...memoryReports];
      if (status && status.trim() !== '') filtered = filtered.filter((r) => r.status === status.toUpperCase());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: { reports: paginated, pagination: { page: pageNum, limit: limitNum, total, totalPages } },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin: Update report status (RESOLVED | DISMISSED)
 * @route   PATCH /api/admin/reports/:id
 * @access  Private (ADMIN)
 */
const updateReportStatus = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status, resolutionNote = '' } = req.body;

    if (!status || !['RESOLVED', 'DISMISSED', 'UNDER_REVIEW'].includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid report status.' });
    }

    let report;
    if (checkDBConnection()) {
      report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report record not found.' });

      report.status = status.toUpperCase();
      report.reviewedBy = adminId;
      report.reviewedAt = new Date();
      if (resolutionNote) report.resolutionNote = resolutionNote.trim();
      await report.save();

      return res.status(200).json({
        success: true,
        message: `Report status updated to ${status.toUpperCase()}.`,
        data: { report },
      });
    } else {
      report = memoryReports.find((r) => r._id === req.params.id || r.id === req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report record not found.' });

      report.status = status.toUpperCase();
      report.reviewedBy = adminId;
      report.reviewedAt = new Date().toISOString();
      if (resolutionNote) report.resolutionNote = resolutionNote.trim();

      return res.status(200).json({
        success: true,
        message: `Report status updated to ${status.toUpperCase()}.`,
        data: { report },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getAdminReports,
  updateReportStatus,
  memoryReports,
};
