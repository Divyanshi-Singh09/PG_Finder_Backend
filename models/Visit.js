const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      required: true,
      index: true,
    },
    availabilitySlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AvailabilitySlot',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      default: 'REQUESTED',
      index: true,
    },
    seekerNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    ownerNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

visitSchema.index({ seeker: 1, status: 1 });
visitSchema.index({ owner: 1, status: 1 });
visitSchema.index({ pg: 1, date: 1 });
visitSchema.index({ seeker: 1, availabilitySlot: 1, status: 1 });

module.exports = mongoose.model('Visit', visitSchema);
