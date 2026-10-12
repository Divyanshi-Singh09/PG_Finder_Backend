const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      required: true,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    bedNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'],
      default: 'AVAILABLE',
      index: true,
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ pg: 1, status: 1 });

module.exports = mongoose.model('Bed', bedSchema);
