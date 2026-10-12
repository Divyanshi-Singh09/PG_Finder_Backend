const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complainant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    category: {
      type: String,
      enum: ['SAFETY', 'MAINTENANCE', 'BILLING_DISPUTE', 'NOISE', 'CLEANLINESS', 'OTHER'],
      default: 'OTHER',
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Please provide a subject for the complaint'],
      trim: true,
      maxlength: [120, 'Subject cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please describe the complaint details'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN',
      index: true,
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolutionReason: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
