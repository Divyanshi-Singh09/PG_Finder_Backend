const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: true,
      index: true,
    },
    moveInDate: {
      type: Date,
      required: [true, 'Please select a move-in date'],
    },
    rentAtBooking: {
      type: Number,
      required: true,
    },
    securityDepositAtBooking: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    seekerMessage: {
      type: String,
      trim: true,
      default: '',
    },
    ownerResponse: {
      type: String,
      trim: true,
      default: '',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ seeker: 1, status: 1 });
bookingSchema.index({ owner: 1, status: 1 });
bookingSchema.index({ pg: 1, status: 1 });
bookingSchema.index({ bed: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
