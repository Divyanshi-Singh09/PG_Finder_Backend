const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PG',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Please provide room number'],
      trim: true,
    },
    roomType: {
      type: String,
      enum: ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'DORMITORY'],
      default: 'DOUBLE',
    },
    totalBeds: {
      type: Number,
      required: [true, 'Please provide total number of beds'],
      min: [1, 'Room must have at least 1 bed'],
    },
    availableBeds: {
      type: Number,
      default: function () {
        return this.totalBeds;
      },
      min: 0,
    },
    rent: {
      type: Number,
      required: [true, 'Please provide monthly rent'],
      min: [0, 'Rent cannot be negative'],
    },
    securityDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Security deposit cannot be negative'],
    },
    amenities: [{ type: String }],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'FULL', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index enforcing unique room number within a PG
roomSchema.index({ pg: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
