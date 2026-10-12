const notificationService = require('../services/notificationService');

/**
 * @desc    Get user notifications with category & pagination
 * @route   GET /api/notifications
 * @access  Private
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category, isRead, page = 1, limit = 20 } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      category,
      isRead,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const notification = await notificationService.markAsRead(userId, notifId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all user notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const deleted = await notificationService.deleteNotification(userId, notifId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found or access denied.' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
