const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'BOOKING_REQUEST',
        'BOOKING_ACCEPTED',
        'BOOKING_REJECTED',
        'BOOKING_CANCELLED',
        'ENQUIRY_RECEIVED',
        'ENQUIRY_REPLIED',
        'ENQUIRY_CLOSED',
        'VISIT_REQUESTED',
        'VISIT_ACCEPTED',
        'VISIT_REJECTED',
        'VISIT_CANCELLED',
        'VISIT_REMINDER',
        'PG_SUBMITTED',
        'PG_APPROVED',
        'PG_REJECTED',
        'PG_SUSPENDED',
        'PG_RESTORED',
        'OWNER_VERIFIED',
        'OWNER_REJECTED',
        'REVIEW_RECEIVED',
        'REVIEW_APPROVED',
        'REVIEW_REJECTED',
        'REVIEW_REPORTED',
        'REVIEW_MODERATED',
        'REPORT_CREATED',
        'REPORT_RESOLVED',
        'COMPLAINT_CREATED',
        'COMPLAINT_UPDATED',
        'COMPLAINT_RESOLVED',
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_REACTIVATED',
        'SYSTEM_NOTIFICATION',
      ],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['BOOKINGS', 'ENQUIRIES', 'VISITS', 'PG', 'REVIEWS', 'REPORTS', 'COMPLAINTS', 'ACCOUNT', 'SYSTEM'],
      default: 'SYSTEM',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['BOOKING', 'ENQUIRY', 'VISIT', 'PG', 'REVIEW', 'REPORT', 'COMPLAINT', 'USER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    entityId: {
      type: String,
      default: '',
    },
    actionUrl: {
      type: String,
      default: '',
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
