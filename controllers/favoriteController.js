const Favorite = require('../models/Favorite');
const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');
const { memoryPGs } = require('./pgController');

// Memory store fallback for favorites in local dev
const memoryFavorites = [];

/**
 * @desc    Save a PG property to seeker's favorites
 * @route   POST /api/favorites/:pgId
 * @access  Private (SEEKER)
 */
const saveFavorite = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId } = req.params;

    if (checkDBConnection()) {
      const pg = await PG.findOne({ _id: pgId, isDeleted: false });
      if (!pg) {
        return res.status(404).json({ success: false, message: 'PG property not found.' });
      }

      // Check if already saved
      const existing = await Favorite.findOne({ seeker: seekerId, pg: pgId });
      if (existing) {
        return res.status(200).json({ success: true, message: 'PG is already saved in your favourites.' });
      }

      await Favorite.create({ seeker: seekerId, pg: pgId });
      return res.status(201).json({ success: true, message: 'PG saved successfully to your favourites.' });
    } else {
      const pg = memoryPGs.find((p) => (p._id === pgId || p.id === pgId) && !p.isDeleted);
      if (!pg) {
        return res.status(404).json({ success: false, message: 'PG property not found.' });
      }

      const existing = memoryFavorites.find((f) => f.seeker === seekerId && (f.pg === pgId || f.pg?._id === pgId || f.pg?.id === pgId));
      if (existing) {
        return res.status(200).json({ success: true, message: 'PG is already saved in your favourites.' });
      }

      memoryFavorites.unshift({
        _id: `fav-mem-${Date.now()}`,
        seeker: seekerId,
        pg,
        createdAt: new Date().toISOString(),
      });

      return res.status(201).json({ success: true, message: 'PG saved successfully to your favourites.' });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ success: true, message: 'PG is already saved in your favourites.' });
    }
    next(error);
  }
};

/**
 * @desc    Remove a PG property from seeker's favorites
 * @route   DELETE /api/favorites/:pgId
 * @access  Private (SEEKER)
 */
const removeFavorite = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId } = req.params;

    if (checkDBConnection()) {
      await Favorite.findOneAndDelete({ seeker: seekerId, pg: pgId });
      return res.status(200).json({ success: true, message: 'PG removed from saved list.' });
    } else {
      const idx = memoryFavorites.findIndex(
        (f) => f.seeker === seekerId && (f.pg === pgId || f.pg?._id === pgId || f.pg?.id === pgId)
      );
      if (idx !== -1) {
        memoryFavorites.splice(idx, 1);
      }
      return res.status(200).json({ success: true, message: 'PG removed from saved list.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get seeker's saved PGs list
 * @route   GET /api/favorites
 * @access  Private (SEEKER)
 */
const getFavorites = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (pageNum - 1) * limitNum;

    if (checkDBConnection()) {
      const total = await Favorite.countDocuments({ seeker: seekerId });
      const favorites = await Favorite.find({ seeker: seekerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('pg');

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: {
          favorites: favorites.map((f) => f.pg).filter(Boolean),
          pagination: { page: pageNum, limit: limitNum, total, totalPages },
        },
      });
    } else {
      const userFavs = memoryFavorites.filter((f) => f.seeker === seekerId);
      const total = userFavs.length;
      const paginated = userFavs.slice(skip, skip + limitNum);
      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.status(200).json({
        success: true,
        data: {
          favorites: paginated.map((f) => f.pg).filter(Boolean),
          pagination: { page: pageNum, limit: limitNum, total, totalPages },
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check favorite status for a PG
 * @route   GET /api/favorites/:pgId/status
 * @access  Private (SEEKER)
 */
const getFavoriteStatus = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { pgId } = req.params;

    if (checkDBConnection()) {
      const existing = await Favorite.findOne({ seeker: seekerId, pg: pgId });
      return res.status(200).json({
        success: true,
        data: { isSaved: !!existing },
      });
    } else {
      const existing = memoryFavorites.find(
        (f) => f.seeker === seekerId && (f.pg === pgId || f.pg?._id === pgId || f.pg?.id === pgId)
      );
      return res.status(200).json({
        success: true,
        data: { isSaved: !!existing },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveFavorite,
  removeFavorite,
  getFavorites,
  getFavoriteStatus,
};
