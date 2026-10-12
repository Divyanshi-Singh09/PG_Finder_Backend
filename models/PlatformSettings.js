const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: 'PGFinder',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: 'support@pgfinder.com',
      trim: true,
    },
    supportPhone: {
      type: String,
      default: '+91 98765 43210',
      trim: true,
    },
    defaultSearchRadius: {
      type: Number,
      default: 10,
    },
    reviewWindowDays: {
      type: Number,
      default: 30,
    },
    autoApproveVerifiedOwners: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
