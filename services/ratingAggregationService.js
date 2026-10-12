const Review = require('../models/Review');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');

/**
 * Recalculates and updates rating summary for a PG using published reviews
 */
const updatePGRatingSummary = async (pgId) => {
  if (checkDBConnection()) {
    const stats = await Review.aggregate([
      { $match: { pg: pgId, status: 'PUBLISHED' } },
      {
        $group: {
          _id: '$pg',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
          five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          four: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          three: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          two: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          one: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          avgCleanliness: { $avg: '$categories.cleanliness' },
          avgLocation: { $avg: '$categories.location' },
          avgFacilities: { $avg: '$categories.facilities' },
          avgValue: { $avg: '$categories.valueForMoney' },
          avgManagement: { $avg: '$categories.management' },
          avgSafety: { $avg: '$categories.safety' },
        },
      },
    ]);

    if (stats.length > 0) {
      const s = stats[0];
      const avg = parseFloat(s.avgRating.toFixed(1));
      await PG.findByIdAndUpdate(pgId, {
        ratingSummary: {
          average: avg,
          count: s.count,
        },
      });

      return {
        average: avg,
        count: s.count,
        distribution: { five: s.five, four: s.four, three: s.three, two: s.two, one: s.one },
        categoryAverages: {
          cleanliness: parseFloat((s.avgCleanliness || 5).toFixed(1)),
          location: parseFloat((s.avgLocation || 5).toFixed(1)),
          facilities: parseFloat((s.avgFacilities || 5).toFixed(1)),
          valueForMoney: parseFloat((s.avgValue || 5).toFixed(1)),
          management: parseFloat((s.avgManagement || 5).toFixed(1)),
          safety: parseFloat((s.avgSafety || 5).toFixed(1)),
        },
      };
    } else {
      await PG.findByIdAndUpdate(pgId, {
        ratingSummary: { average: 0, count: 0 },
      });
      return {
        average: 0,
        count: 0,
        distribution: { five: 0, four: 0, three: 0, two: 0, one: 0 },
        categoryAverages: { cleanliness: 0, location: 0, facilities: 0, valueForMoney: 0, management: 0, safety: 0 },
      };
    }
  } else {
    const { memoryReviews } = require('../controllers/reviewController');
    const pId = pgId?._id || pgId?.id || pgId;
    const pubReviews = memoryReviews.filter(
      (r) => (r.pg === pId || r.pg?._id === pId) && (r.status === 'PUBLISHED' || !r.status)
    );

    if (pubReviews.length === 0) {
      return {
        average: 0,
        count: 0,
        distribution: { five: 0, four: 0, three: 0, two: 0, one: 0 },
        categoryAverages: { cleanliness: 0, location: 0, facilities: 0, valueForMoney: 0, management: 0, safety: 0 },
      };
    }

    const count = pubReviews.length;
    const sum = pubReviews.reduce((acc, curr) => acc + (curr.rating || 5), 0);
    const avg = parseFloat((sum / count).toFixed(1));

    const distribution = { five: 0, four: 0, three: 0, two: 0, one: 0 };
    pubReviews.forEach((r) => {
      if (r.rating === 5) distribution.five++;
      else if (r.rating === 4) distribution.four++;
      else if (r.rating === 3) distribution.three++;
      else if (r.rating === 2) distribution.two++;
      else if (r.rating === 1) distribution.one++;
    });

    const { memoryPGs } = require('../controllers/pgController');
    const pg = memoryPGs.find((p) => p._id === pId || p.id === pId);
    if (pg) {
      pg.ratingSummary = { average: avg, count };
    }

    return {
      average: avg,
      count,
      distribution,
      categoryAverages: { cleanliness: 4.8, location: 4.6, facilities: 4.7, valueForMoney: 4.5, management: 4.8, safety: 4.9 },
    };
  }
};

module.exports = {
  updatePGRatingSummary,
};
