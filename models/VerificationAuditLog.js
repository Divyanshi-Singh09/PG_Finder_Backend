const mongoose = require('mongoose');

const verificationAuditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['OWNER_VERIFICATION', 'PG_VERIFICATION', 'REPORT'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMITTED', 'SUSPENDED', 'UNSUSPENDED', 'RESOLVED', 'DISMISSED'],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

verificationAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationAuditLog', verificationAuditLogSchema);
