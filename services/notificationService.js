const Notification = require('../models/Notification');
const { checkDBConnection } = require('../config/db');

// Memory store fallback for notifications in local dev
const memoryNotifications = [];

/**
 * Centralized Notification Service Module
 */

const getRecipientString = (recipient) => {
  if (!recipient) return '';
  if (typeof recipient === 'object') {
    return (recipient._id || recipient.id || recipient).toString();
  }
  return recipient.toString();
};

const determineCategory = (type, entityType) => {
  if (type?.startsWith('BOOKING') || entityType === 'BOOKING') return 'BOOKINGS';
  if (type?.startsWith('ENQUIRY') || entityType === 'ENQUIRY') return 'ENQUIRIES';
  if (type?.startsWith('VISIT') || entityType === 'VISIT') return 'VISITS';
  if (type?.startsWith('PG') || entityType === 'PG') return 'PG';
  if (type?.startsWith('REVIEW') || entityType === 'REVIEW') return 'REVIEWS';
  if (type?.startsWith('REPORT') || entityType === 'REPORT') return 'REPORTS';
  if (type?.startsWith('COMPLAINT') || entityType === 'COMPLAINT') return 'COMPLAINTS';
  if (type?.startsWith('ACCOUNT') || type?.startsWith('OWNER') || entityType === 'USER') return 'ACCOUNT';
  return 'SYSTEM';
};

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  entityType = 'SYSTEM',
  entityId = '',
  actionUrl = '',
  category = null,
}) => {
  try {
    if (!recipient || !type || !title || !message) return null;

    const recipientId = getRecipientString(recipient);
    const resolvedCategory = category || determineCategory(type, entityType);

    if (checkDBConnection()) {
      // Deduplication: prevent identical notification within 2 minutes
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
      const existing = await Notification.findOne({
        recipient: recipientId,
        type,
        entityId: entityId ? entityId.toString() : '',
        createdAt: { $gte: twoMinsAgo },
      });

      if (existing) return existing;

      const notification = await Notification.create({
        recipient: recipientId,
        type,
        category: resolvedCategory,
        title,
        message,
        entityType,
        entityId: entityId ? entityId.toString() : '',
        actionUrl: actionUrl.trim(),
        isRead: false,
      });

      return notification;
    } else {
      const existing = memoryNotifications.find(
        (n) =>
          getRecipientString(n.recipient) === recipientId &&
          n.type === type &&
          n.entityId === (entityId ? entityId.toString() : '')
      );

      if (existing) return existing;

      const newNotif = {
        _id: `notif-mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recipient: recipientId,
        type,
        category: resolvedCategory,
        title,
        message,
        entityType,
        entityId: entityId ? entityId.toString() : '',
        actionUrl: actionUrl.trim(),
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      memoryNotifications.unshift(newNotif);
      return newNotif;
    }
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error.message);
    return null;
  }
};

const getUserNotifications = async (userId, params = {}) => {
  const { category, isRead, page = 1, limit = 20 } = params;
  const recipientId = getRecipientString(userId);
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (checkDBConnection()) {
    const filter = { recipient: recipientId };
    if (category && category !== 'ALL') filter.category = category.toUpperCase();
    if (isRead !== undefined && isRead !== '') filter.isRead = isRead === 'true' || isRead === true;

    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    const unreadCount = await Notification.countDocuments({ recipient: recipientId, isRead: false });

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      notifications,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
      unreadCount,
    };
  } else {
    let filtered = memoryNotifications.filter((n) => getRecipientString(n.recipient) === recipientId);
    if (category && category !== 'ALL') filtered = filtered.filter((n) => n.category === category.toUpperCase());
    if (isRead !== undefined && isRead !== '') {
      const readBool = isRead === 'true' || isRead === true;
      filtered = filtered.filter((n) => n.isRead === readBool);
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);
    const unreadCount = memoryNotifications.filter((n) => getRecipientString(n.recipient) === recipientId && !n.isRead).length;
    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      notifications: paginated,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
      unreadCount,
    };
  }
};

const getUnreadCount = async (userId) => {
  const recipientId = getRecipientString(userId);
  if (checkDBConnection()) {
    return await Notification.countDocuments({ recipient: recipientId, isRead: false });
  } else {
    return memoryNotifications.filter((n) => getRecipientString(n.recipient) === recipientId && !n.isRead).length;
  }
};

const markAsRead = async (userId, notificationId) => {
  const recipientId = getRecipientString(userId);
  if (checkDBConnection()) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: recipientId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  } else {
    const notif = memoryNotifications.find((n) => (n._id === notificationId || n.id === notificationId) && getRecipientString(n.recipient) === recipientId);
    if (notif) {
      notif.isRead = true;
      notif.readAt = new Date().toISOString();
    }
    return notif;
  }
};

const markAllAsRead = async (userId) => {
  const recipientId = getRecipientString(userId);
  if (checkDBConnection()) {
    await Notification.updateMany({ recipient: recipientId, isRead: false }, { isRead: true, readAt: new Date() });
    return true;
  } else {
    memoryNotifications.forEach((n) => {
      if (getRecipientString(n.recipient) === recipientId) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      }
    });
    return true;
  }
};

const deleteNotification = async (userId, notificationId) => {
  const recipientId = getRecipientString(userId);
  if (checkDBConnection()) {
    return await Notification.findOneAndDelete({ _id: notificationId, recipient: recipientId });
  } else {
    const idx = memoryNotifications.findIndex((n) => (n._id === notificationId || n.id === notificationId) && getRecipientString(n.recipient) === recipientId);
    if (idx !== -1) {
      memoryNotifications.splice(idx, 1);
      return true;
    }
    return false;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  memoryNotifications,
};
