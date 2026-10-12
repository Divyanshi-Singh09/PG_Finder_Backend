const Favorite = require('../models/Favorite');
const Enquiry = require('../models/Enquiry');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Visit = require('../models/Visit');
const Room = require('../models/Room');
const Bed = require('../models/Bed');
const PG = require('../models/PG');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');
const { memoryReviews } = require('./reviewController');
const { memoryNotifications } = require('../services/notificationService');

/**
 * @desc    Get Seeker Dashboard Metrics & Recent Activity
 * @route   GET /api/dashboard/seeker
 * @access  Private (SEEKER)
 */
const getSeekerDashboard = async (req, res, next) => {
  try {
    const seekerId = req.user.id;

    if (checkDBConnection()) {
      const [savedPGs, activeEnquiries, responses, reviews, notifications] = await Promise.all([
        Favorite.countDocuments({ seeker: seekerId }),
        Enquiry.countDocuments({ seeker: seekerId, status: { $in: ['PENDING', 'RESPONDED'] } }),
        Enquiry.countDocuments({ seeker: seekerId, status: 'RESPONDED' }),
        Review.countDocuments({ seeker: seekerId }),
        Notification.find({ recipient: seekerId }).sort({ createdAt: -1 }).limit(5),
      ]);

      const recentActivity = notifications.map((n) => ({
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        date: n.createdAt,
        isRead: n.isRead,
        entityType: n.entityType,
        entityId: n.entityId,
      }));

      return res.status(200).json({
        success: true,
        data: {
          savedPGs,
          activeEnquiries,
          responses,
          reviews,
          recentActivity,
        },
      });
    } else {
      const userNotifs = memoryNotifications.filter(
        (n) => n.recipient === seekerId || n.recipient?.id === seekerId
      );

      return res.status(200).json({
        success: true,
        data: {
          savedPGs: 2,
          activeEnquiries: 1,
          responses: 1,
          reviews: 1,
          recentActivity: userNotifs.slice(0, 5).map((n) => ({
            id: n._id || n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            date: n.createdAt,
            isRead: n.isRead,
            entityType: n.entityType,
            entityId: n.entityId,
          })),
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Owner Dashboard Metrics & Recent Activity
 * @route   GET /api/dashboard/owner
 * @access  Private (OWNER, ADMIN)
 */
const getOwnerDashboard = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    if (checkDBConnection()) {
      const pgs = await PG.find({ owner: ownerId, isDeleted: false });
      const pgIds = pgs.map((p) => p._id);

      const [rooms, bookings, enquiries, visits, reviews, notifications, unreadNotifCount] = await Promise.all([
        Room.find({ pg: { $in: pgIds }, status: 'ACTIVE' }),
        Booking.find({ owner: ownerId }),
        Enquiry.find({ owner: ownerId }),
        Visit.find({ owner: ownerId }),
        Review.find({ owner: ownerId }),
        Notification.find({ recipient: ownerId }).sort({ createdAt: -1 }).limit(5),
        Notification.countDocuments({ recipient: ownerId, isRead: false }),
      ]);

      const roomIds = rooms.map((r) => r._id);
      const beds = await Bed.find({ room: { $in: roomIds } });

      const totalPGs = pgs.length;
      const approvedPGs = pgs.filter((p) => p.status === 'APPROVED').length;
      const pendingPGs = pgs.filter((p) => p.status === 'PENDING').length;
      const activeRooms = rooms.length;
      const availableBeds = beds.filter((b) => b.status === 'AVAILABLE').length;
      const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length;
      const pendingBookings = bookings.filter((b) => b.status === 'PENDING').length;
      const activeBookings = bookings.filter((b) => b.status === 'ACCEPTED').length;
      const unreadEnquiries = enquiries.filter((e) => e.status === 'PENDING').length;
      const upcomingVisits = visits.filter((v) => v.status === 'REQUESTED' || v.status === 'CONFIRMED').length;

      const publishedReviews = reviews.filter((r) => r.status === 'APPROVED' || r.status === 'PUBLISHED');
      const avgRating = publishedReviews.length > 0
        ? parseFloat((publishedReviews.reduce((acc, r) => acc + r.rating, 0) / publishedReviews.length).toFixed(1))
        : 4.5;

      const recentActivity = notifications.map((n) => ({
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        date: n.createdAt,
        isRead: n.isRead,
        entityType: n.entityType,
        entityId: n.entityId,
      }));

      return res.status(200).json({
        success: true,
        data: {
          totalPGs,
          approvedPGs,
          pendingPGs,
          activeRooms,
          availableBeds,
          occupiedBeds,
          pendingBookings,
          activeBookings,
          unreadEnquiries,
          upcomingVisits,
          avgRating,
          unreadNotifications: unreadNotifCount,
          recentActivity,
        },
      });
    } else {
      const userNotifs = memoryNotifications.filter(
        (n) => n.recipient === ownerId || n.recipient?.id === ownerId
      );

      return res.status(200).json({
        success: true,
        data: {
          totalPGs: 2,
          approvedPGs: 2,
          pendingPGs: 0,
          activeRooms: 6,
          availableBeds: 5,
          occupiedBeds: 15,
          pendingBookings: 2,
          activeBookings: 8,
          unreadEnquiries: 1,
          upcomingVisits: 3,
          avgRating: 4.7,
          unreadNotifications: userNotifs.filter((n) => !n.isRead).length,
          recentActivity: userNotifs.slice(0, 5).map((n) => ({
            id: n._id || n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            date: n.createdAt,
            isRead: n.isRead,
            entityType: n.entityType,
            entityId: n.entityId,
          })),
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Admin Dashboard Metrics
 * @route   GET /api/dashboard/admin
 * @access  Private (ADMIN)
 */
const getAdminDashboard = async (req, res, next) => {
  const adminController = require('./adminController');
  return adminController.getDashboardStats(req, res, next);
};

module.exports = {
  getSeekerDashboard,
  getOwnerDashboard,
  getAdminDashboard,
};
