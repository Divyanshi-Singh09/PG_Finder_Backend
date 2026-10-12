const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    seeker: {
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
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate saves of the same PG by the same seeker
favoriteSchema.index({ seeker: 1, pg: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
