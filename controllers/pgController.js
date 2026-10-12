const PG = require('../models/PG');
const SavedSearch = require('../models/SavedSearch');
const { checkDBConnection } = require('../config/db');
const { searchPGs: executePGSearch, getAutocompleteSuggestions } = require('../services/pgSearchService');
const { sampleApprovedPGs } = require('../utils/seedPGs');

// In-Memory PG Store pre-populated with realistic approved listings for local dev
const memoryPGs = [
  ...sampleApprovedPGs.map((p, idx) => ({
    _id: `pg-appr-00${idx + 1}`,
    id: `pg-appr-00${idx + 1}`,
    owner: 'usr-mem-002',
    isDeleted: false,
    createdAt: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...p,
  })),
];

const memorySavedSearches = [];

const calculateRentRange = (roomTypes = []) => {
  if (!roomTypes || roomTypes.length === 0) return { min: 0, max: 0 };
  const rents = roomTypes.map((r) => r.rent).filter((r) => typeof r === 'number' && r > 0);
  if (rents.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...rents),
    max: Math.max(...rents),
  };
};

const searchPGs = async (req, res, next) => {
  try {
    const result = await executePGSearch(req.query, memoryPGs);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getPGAutocomplete = async (req, res, next) => {
  try {
    const suggestions = await getAutocompleteSuggestions(req.query.q || req.query.search);
    res.status(200).json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    next(error);
  }
};

const getPGRecommendations = async (req, res, next) => {
  try {
    const { getRecommendations } = require('../services/pgSearchService');
    const pgs = await getRecommendations(req.query, memoryPGs);
    res.status(200).json({
      success: true,
      data: { pgs },
    });
  } catch (error) {
    next(error);
  }
};

const getSimilarPGsController = async (req, res, next) => {
  try {
    const { getSimilarPGs } = require('../services/pgSearchService');
    const pgs = await getSimilarPGs(req.params.id, memoryPGs);
    res.status(200).json({
      success: true,
      data: { pgs },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicPGById = async (req, res, next) => {
  try {
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, status: 'APPROVED', isDeleted: false }).populate(
        'owner',
        'name'
      );
    } else {
      pg = memoryPGs.find(
        (p) => (p._id === req.params.id || p.id === req.params.id) && p.status === 'APPROVED' && !p.isDeleted
      );
    }

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG property not found or not approved',
      });
    }

    res.status(200).json({
      success: true,
      data: { pg },
    });
  } catch (error) {
    next(error);
  }
};

const createPG = async (req, res, next) => {
  try {
    const { name, description, address, genderPreference, pgType, roomTypes, facilities, rules, food } = req.body;

    const rentRange = calculateRentRange(roomTypes);

    if (checkDBConnection()) {
      const pg = await PG.create({
        owner: req.user.id,
        name,
        description,
        address,
        genderPreference,
        pgType,
        roomTypes,
        rent: rentRange,
        facilities: facilities || [],
        rules: rules || [],
        food: food || { available: false },
        status: 'DRAFT',
      });

      res.status(201).json({
        success: true,
        message: 'PG draft created successfully',
        data: { pg },
      });
    } else {
      const newPG = {
        _id: `pg-mem-${Date.now()}`,
        id: `pg-mem-${Date.now()}`,
        owner: req.user.id,
        name,
        description,
        address,
        genderPreference,
        pgType,
        roomTypes,
        rent: rentRange,
        facilities: facilities || [],
        rules: rules || [],
        food: food || { available: false },
        status: 'DRAFT',
        images: [],
        availability: { status: 'AVAILABLE', availableBeds: 5 },
        verificationStatus: 'UNVERIFIED',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryPGs.unshift(newPG);

      res.status(201).json({
        success: true,
        message: 'PG draft created successfully',
        data: { pg: newPG },
      });
    }
  } catch (error) {
    next(error);
  }
};

const getMyPGs = async (req, res, next) => {
  try {
    let pgs;
    if (checkDBConnection()) {
      pgs = await PG.find({ owner: req.user.id, isDeleted: false }).sort({ createdAt: -1 });
    } else {
      pgs = memoryPGs.filter(
        (p) => (p.owner === req.user.id || p.owner?._id === req.user.id || p.owner?.id === req.user.id) && !p.isDeleted
      );
    }

    res.status(200).json({
      success: true,
      data: { pgs },
    });
  } catch (error) {
    next(error);
  }
};

const getPGById = async (req, res, next) => {
  try {
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false });
    } else {
      pg = memoryPGs.find(
        (p) =>
          (p._id === req.params.id || p.id === req.params.id) &&
          (p.owner === req.user.id || p.owner?._id === req.user.id || p.owner?.id === req.user.id) &&
          !p.isDeleted
      );
    }

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG property not found or unauthorized access',
      });
    }

    res.status(200).json({
      success: true,
      data: { pg },
    });
  } catch (error) {
    next(error);
  }
};

const updatePG = async (req, res, next) => {
  try {
    const { roomTypes } = req.body;
    if (roomTypes) {
      req.body.rent = calculateRentRange(roomTypes);
    }

    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, isDeleted: false }, req.body, {
        new: true,
        runValidators: true,
      });
    } else {
      const idx = memoryPGs.findIndex(
        (p) =>
          (p._id === req.params.id || p.id === req.params.id) &&
          (p.owner === req.user.id || p.owner?._id === req.user.id || p.owner?.id === req.user.id) &&
          !p.isDeleted
      );
      if (idx !== -1) {
        memoryPGs[idx] = { ...memoryPGs[idx], ...req.body, updatedAt: new Date().toISOString() };
        pg = memoryPGs[idx];
      }
    }

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG property not found or unauthorized edit',
      });
    }

    res.status(200).json({
      success: true,
      message: 'PG property updated successfully',
      data: { pg },
    });
  } catch (error) {
    next(error);
  }
};

const deletePG = async (req, res, next) => {
  try {
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );
    } else {
      const idx = memoryPGs.findIndex(
        (p) =>
          (p._id === req.params.id || p.id === req.params.id) &&
          (p.owner === req.user.id || p.owner?._id === req.user.id || p.owner?.id === req.user.id) &&
          !p.isDeleted
      );
      if (idx !== -1) {
        memoryPGs[idx].isDeleted = true;
        pg = memoryPGs[idx];
      }
    }

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG property not found or unauthorized action',
      });
    }

    res.status(200).json({
      success: true,
      message: 'PG property deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

const submitPG = async (req, res, next) => {
  try {
    let pg;
    if (checkDBConnection()) {
      pg = await PG.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false });
    } else {
      pg = memoryPGs.find(
        (p) =>
          (p._id === req.params.id || p.id === req.params.id) &&
          (p.owner === req.user.id || p.owner?._id === req.user.id || p.owner?.id === req.user.id) &&
          !p.isDeleted
      );
    }

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG property not found or unauthorized action',
      });
    }

    const missingFields = [];
    if (!pg.name) missingFields.push('Property Name');
    if (!pg.description || pg.description.trim().length < 10) missingFields.push('Detailed Description (min 10 chars)');
    if (!pg.address?.city) missingFields.push('City');
    if (!pg.address?.pincode) missingFields.push('Pincode');
    if (!pg.roomTypes || pg.roomTypes.length === 0) missingFields.push('At least one Room Type');
    if (!pg.images || pg.images.length === 0) missingFields.push('At least one Property Image');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Your PG cannot be submitted yet. Please complete required fields.',
        missingFields,
      });
    }

    pg.status = 'PENDING';
    pg.rejectionReason = '';

    if (checkDBConnection()) {
      await pg.save();
    }

    res.status(200).json({
      success: true,
      message: 'PG property submitted for verification successfully!',
      data: { pg },
    });
  } catch (error) {
    next(error);
  }
};

// Saved Search Controller Endpoints
const saveSearch = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { name, filters } = req.body;

    if (!name || !filters) {
      return res.status(400).json({ success: false, message: 'Please provide search name and filter parameters.' });
    }

    if (checkDBConnection()) {
      const saved = await SavedSearch.create({
        seeker: seekerId,
        name: name.trim(),
        filters,
      });
      return res.status(201).json({ success: true, message: 'Search saved successfully!', data: { savedSearch: saved } });
    } else {
      const saved = {
        _id: `ss-mem-${Date.now()}`,
        seeker: seekerId,
        name: name.trim(),
        filters,
        createdAt: new Date().toISOString(),
      };
      memorySavedSearches.unshift(saved);
      return res.status(201).json({ success: true, message: 'Search saved successfully!', data: { savedSearch: saved } });
    }
  } catch (error) {
    next(error);
  }
};

const getSavedSearches = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    if (checkDBConnection()) {
      const searches = await SavedSearch.find({ seeker: seekerId }).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: { savedSearches: searches } });
    } else {
      const searches = memorySavedSearches.filter((s) => s.seeker === seekerId);
      return res.status(200).json({ success: true, data: { savedSearches: searches } });
    }
  } catch (error) {
    next(error);
  }
};

const deleteSavedSearch = async (req, res, next) => {
  try {
    const seekerId = req.user.id;
    const { id } = req.params;

    if (checkDBConnection()) {
      await SavedSearch.findOneAndDelete({ _id: id, seeker: seekerId });
    } else {
      const idx = memorySavedSearches.findIndex((s) => (s._id === id || s.id === id) && s.seeker === seekerId);
      if (idx !== -1) memorySavedSearches.splice(idx, 1);
    }

    res.status(200).json({ success: true, message: 'Saved search deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchPGs,
  getPGAutocomplete,
  getPGRecommendations,
  getSimilarPGsController,
  getPublicPGById,
  createPG,
  getMyPGs,
  getPGById,
  updatePG,
  deletePG,
  submitPG,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  memoryPGs,
};
