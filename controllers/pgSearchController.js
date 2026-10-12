const pgSearchService = require('../services/pgSearchService');

/**
 * @desc    Search approved PG listings with advanced filters, geolocation, and sorting
 * @route   GET /api/pgs/search
 * @access  Public
 */
const searchPGs = async (req, res, next) => {
  try {
    const result = await pgSearchService.searchPGs(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchPGs,
};
