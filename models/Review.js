const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5 stars'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    categories: {
      cleanliness: { type: Number, min: 1, max: 5, default: 5 },
      location: { type: Number, min: 1, max: 5, default: 5 },
      facilities: { type: Number, min: 1, max: 5, default: 5 },
      valueForMoney: { type: Number, min: 1, max: 5, default: 5 },
      management: { type: Number, min: 1, max: 5, default: 5 },
      safety: { type: Number, min: 1, max: 5, default: 5 },
    },
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Please provide your review comment'],
      trim: true,
      minlength: [10, 'Comment must be at least 10 characters long'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    images: [{ type: String }],
    status: {
      type: String,
      enum: ['PUBLISHED', 'HIDDEN', 'PENDING_REVIEW', 'REMOVED'],
      default: 'PUBLISHED',
      index: true,
    },
    ownerReply: {
      text: { type: String, trim: true, default: '' },
      repliedAt: { type: Date },
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    moderationReason: {
      type: String,
      default: '',
      trim: true,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce 1 review per booking
reviewSchema.index({ booking: 1 }, { unique: true });
reviewSchema.index({ pg: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
