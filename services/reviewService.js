const Review = require('../models/Review');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');

/**
 * Format full user name into privacy-preserving format
 * e.g. "Rahul Sharma" -> "Rahul S."
 */
const formatReviewerName = (name) => {
  if (!name) return 'Anonymous Seeker';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

/**
 * Calculate & Sync PG Rating Aggregates in MongoDB or Memory
 */
const recalculatePGRatingSummary = async (pgId, memoryPGs = [], memoryReviews = []) => {
  if (checkDBConnection()) {
    const stats = await Review.aggregate([
      { $match: { pg: new (require('mongoose').Types.ObjectId)(pgId), status: 'APPROVED' } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
          one: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          two: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          three: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          four: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        },
      },
    ]);

    let ratingSummary = {
      average: 0,
      count: 0,
      distribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
    };

    if (stats.length > 0) {
      const s = stats[0];
      ratingSummary = {
        average: Math.round(s.average * 10) / 10,
        count: s.count,
        distribution: {
          one: s.one,
          two: s.two,
          three: s.three,
          four: s.four,
          five: s.five,
        },
      };
    }

    await PG.findByIdAndUpdate(pgId, { ratingSummary });
    return ratingSummary;
  } else {
    // Memory calculation fallback
    const approved = memoryReviews.filter(
      (r) => (r.pg === pgId || r.pg?._id === pgId || r.pg?.id === pgId) && r.status === 'APPROVED'
    );

    let ratingSummary = {
      average: 0,
      count: approved.length,
      distribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
    };

    if (approved.length > 0) {
      const sum = approved.reduce((acc, r) => acc + r.rating, 0);
      const avg = Math.round((sum / approved.length) * 10) / 10;
      approved.forEach((r) => {
        if (r.rating === 1) ratingSummary.distribution.one++;
        if (r.rating === 2) ratingSummary.distribution.two++;
        if (r.rating === 3) ratingSummary.distribution.three++;
        if (r.rating === 4) ratingSummary.distribution.four++;
        if (r.rating === 5) ratingSummary.distribution.five++;
      });
      ratingSummary.average = avg;
    }

    const pgObj = memoryPGs.find((p) => p._id === pgId || p.id === pgId);
    if (pgObj) {
      pgObj.ratingSummary = ratingSummary;
    }

    return ratingSummary;
  }
};

module.exports = {
  formatReviewerName,
  recalculatePGRatingSummary,
};
