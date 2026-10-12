const mongoose = require('mongoose');

const pgModerationLogSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      required: true,
      index: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'SUSPENDED', 'REACTIVATED'],
      required: true,
    },
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
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

pgModerationLogSchema.index({ pg: 1, createdAt: -1 });

module.exports = mongoose.model('PGModerationLog', pgModerationLogSchema);
