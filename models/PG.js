const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'DORMITORY'],
    required: true,
  },
  rent: {
    type: Number,
    required: true,
    min: [0, 'Rent must be positive'],
  },
  availableRooms: {
    type: Number,
    default: 1,
    min: 0,
  },
  totalRooms: {
    type: Number,
    default: 1,
    min: 1,
  },
  deposit: {
    type: Number,
    default: 0,
  },
  amenities: [{ type: String }],
});

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: '',
  },
  isCover: {
    type: Boolean,
    default: false,
  },
});

const pgSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, 'Please provide PG name'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Please provide PG description'],
      trim: true,
    },

    pgType: {
      type: String,
      enum: ['BOYS', 'GIRLS', 'CO_LIVING'],
      required: [true, 'Please specify PG type'],
    },

    address: {
      line1: { type: String, trim: true },
      locality: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true, index: true },
      state: { type: String, trim: true },
      pincode: { type: String, required: true, trim: true },
    },

    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      type: { type: String, default: 'Point' },
      coordinates: [{ type: Number }], // GeoJSON [lng, lat]
    },

    contact: {
      phone: { type: String, required: true, trim: true },
      alternatePhone: { type: String, trim: true },
      email: { type: String, trim: true },
    },

    rent: {
      min: { type: Number, required: true, min: 0 },
      max: { type: Number, min: 0 },
    },

    deposit: {
      amount: { type: Number, default: 0 },
      refundable: { type: Boolean, default: true },
    },

    genderPreference: {
      type: String,
      enum: ['MALE', 'FEMALE', 'ANY'],
      default: 'ANY',
    },

    occupancyTypes: [{ type: String }],

    roomTypes: [roomSchema],

    furnishing: {
      type: String,
      enum: ['FULLY_FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'],
      default: 'SEMI_FURNISHED',
    },

    facilities: [{ type: String }],

    food: {
      available: { type: Boolean, default: false },
      type: { type: String, enum: ['VEG', 'NON_VEG', 'BOTH', 'NONE'], default: 'NONE' },
      offerings: [{ type: String }],
    },

    rules: [{ type: String }],

    images: [imageSchema],

    availability: {
      available: { type: Boolean, default: true },
      status: { type: String, enum: ['AVAILABLE', 'FULL', 'TEMPORARILY_UNAVAILABLE'], default: 'AVAILABLE' },
      availableFrom: { type: Date, default: Date.now },
    },

    ratingSummary: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'DRAFT',
      index: true,
    },

    rejectionReason: {
      type: String,
      default: '',
    },

    isVerifiedPG: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      type: String,
      enum: ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'NOT_STARTED',
    },

    suspensionReason: {
      type: String,
      default: '',
    },

    suspendedAt: {
      type: Date,
    },

    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    onlineBookingEnabled: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Database indexes
pgSchema.index({ owner: 1, isDeleted: 1 });
pgSchema.index({ status: 1, isDeleted: 1 });
pgSchema.index({ 'address.city': 1, status: 1, isDeleted: 1 });
pgSchema.index({ 'rent.min': 1, 'rent.max': 1 });
pgSchema.index({ 'location.coordinates': '2dsphere' });
pgSchema.index({ status: 1, 'ratingSummary.average': -1 });

module.exports = mongoose.model('PG', pgSchema);
