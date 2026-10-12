const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema(
  {
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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    maxVisitors: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
    },
    bookedVisitors: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'FULL', 'BLOCKED'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

availabilitySlotSchema.index({ pg: 1, date: 1, status: 1 });
availabilitySlotSchema.index({ owner: 1, date: 1 });

module.exports = mongoose.model('AvailabilitySlot', availabilitySlotSchema);
