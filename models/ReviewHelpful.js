const mongoose = require('mongoose');

const reviewHelpfulSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewHelpfulSchema.index({ review: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ReviewHelpful', reviewHelpfulSchema);
