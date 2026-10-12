const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Facility name is required'],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['BASIC', 'SAFETY', 'COMFORT', 'FOOD', 'ENTERTAINMENT', 'SERVICES'],
      default: 'BASIC',
    },
    iconName: {
      type: String,
      default: 'Check',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Facility', facilitySchema);
