const PG = require('../models/PG');
const { checkDBConnection } = require('../config/db');

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return parseFloat(d.toFixed(2));
};

/**
 * Formats distance in user-friendly format (e.g., "850 m away" or "1.8 km away")
 */
const formatDistanceText = (distKm) => {
  if (distKm === null || distKm === undefined) return null;
  if (distKm < 1) {
    const meters = Math.round(distKm * 1000);
    return `${meters} m away`;
  }
  return `${distKm} km away`;
};

/**
 * Normalizes facility name strings for consistent matching
 */
const normalizeFacilityName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Centralized Location Autocomplete Suggestion Generator
 */
const getAutocompleteSuggestions = async (searchQuery = '') => {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const defaultLocations = [
    { title: 'Sector 62, Noida', type: 'LOCALITY', city: 'Noida', locality: 'Sector 62' },
    { title: 'Sector 63, Noida', type: 'LOCALITY', city: 'Noida', locality: 'Sector 63' },
    { title: 'Indirapuram, Ghaziabad', type: 'LOCALITY', city: 'Ghaziabad', locality: 'Indirapuram' },
    { title: 'Vaishali, Ghaziabad', type: 'LOCALITY', city: 'Ghaziabad', locality: 'Vaishali' },
    { title: 'Greater Noida, Uttar Pradesh', type: 'CITY', city: 'Greater Noida', locality: '' },
    { title: 'Noida, Uttar Pradesh', type: 'CITY', city: 'Noida', locality: '' },
    { title: 'Delhi NCR', type: 'CITY', city: 'Delhi', locality: '' },
  ];

  if (checkDBConnection()) {
    try {
      const qRegex = new RegExp(q, 'i');
      const pgs = await PG.find({
        status: 'APPROVED',
        isDeleted: false,
        $or: [
          { name: qRegex },
          { 'address.locality': qRegex },
          { 'address.city': qRegex },
          { 'address.state': qRegex },
        ],
      }).limit(15);

      const suggestionsMap = new Map();
      pgs.forEach((p) => {
        if (p.address?.locality) {
          const key = `${p.address.locality}, ${p.address.city}`.toLowerCase();
          if (!suggestionsMap.has(key)) {
            suggestionsMap.set(key, {
              title: `${p.address.locality}, ${p.address.city}`,
              type: 'LOCALITY',
              locality: p.address.locality,
              city: p.address.city,
            });
          }
        }
        if (p.address?.city) {
          const key = p.address.city.toLowerCase();
          if (!suggestionsMap.has(key)) {
            suggestionsMap.set(key, {
              title: `${p.address.city}, ${p.address.state || ''}`.trim(),
              type: 'CITY',
              city: p.address.city,
              locality: '',
            });
          }
        }
      });

      const dbSuggestions = Array.from(suggestionsMap.values());
      return dbSuggestions.length > 0 ? dbSuggestions : defaultLocations.filter((l) => l.title.toLowerCase().includes(q));
    } catch (err) {
      return defaultLocations.filter((l) => l.title.toLowerCase().includes(q));
    }
  } else {
    return defaultLocations.filter((l) => l.title.toLowerCase().includes(q));
  }
};

/**
 * Centralized PG Search Engine Service
 */
const searchPGs = async (query = {}, memoryPGsParam = []) => {
  let memoryPGs = memoryPGsParam;
  if (!memoryPGs || memoryPGs.length === 0) {
    try {
      memoryPGs = require('../controllers/pgController').memoryPGs || [];
    } catch (e) {}
  }

  // 1. Whitelist and Sanitize Inputs
  const searchStr = (query.search || query.q || '').trim();
  const city = (query.city || '').trim();
  const locality = (query.locality || '').trim();
  const state = (query.state || '').trim();
  const pincode = (query.pincode || '').trim();

  const minRent = query.minRent !== undefined && !isNaN(query.minRent) ? Math.max(0, parseInt(query.minRent)) : 0;
  const maxRent = query.maxRent !== undefined && !isNaN(query.maxRent) && parseInt(query.maxRent) > 0
    ? parseInt(query.maxRent)
    : 100000;

  // Multiple room types
  let roomTypesArr = [];
  if (Array.isArray(query.roomTypes)) {
    roomTypesArr = query.roomTypes.map((r) => r.toUpperCase());
  } else if (typeof query.roomTypes === 'string' && query.roomTypes.trim() !== '') {
    roomTypesArr = query.roomTypes.split(',').map((r) => r.trim().toUpperCase());
  } else if (query.roomType) {
    roomTypesArr = [query.roomType.toUpperCase()];
  }

  const pgType = query.pgType ? query.pgType.toUpperCase() : null;
  const gender = query.gender ? query.gender.toUpperCase() : null;
  const foodAvailable = query.food === 'true' || query.food === true || query.foodAvailable === 'true';
  const furnishing = query.furnishing ? query.furnishing.toUpperCase() : null;
  const availabilityStatus = query.availabilityStatus ? query.availabilityStatus.toUpperCase() : null;
  const minRating = query.rating && !isNaN(query.rating) ? parseFloat(query.rating) : 0;
  const onlineBookingOnly = query.onlineBooking === 'true' || query.onlineBooking === true;

  // Facilities array parsing & matching mode ('all' vs 'any')
  let rawFacilities = [];
  if (Array.isArray(query.facilities)) {
    rawFacilities = query.facilities;
  } else if (typeof query.facilities === 'string' && query.facilities.trim() !== '') {
    rawFacilities = query.facilities.split(',');
  }
  const facilitiesList = rawFacilities.map(normalizeFacilityName).filter(Boolean);
  const facilityMatching = (query.facilityMatching || 'all').toLowerCase(); // 'all' | 'any'

  // Location GPS parameters
  const userLat = query.lat && !isNaN(query.lat) ? parseFloat(query.lat) : null;
  const userLng = query.lng && !isNaN(query.lng) ? parseFloat(query.lng) : null;
  const radiusKm = query.radius && !isNaN(query.radius) ? Math.min(100, Math.max(1, parseFloat(query.radius))) : 10;

  // Sorting & Pagination
  const sortOption = query.sort || 'relevance';
  const pageNum = Math.max(1, parseInt(query.page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
  const skip = (pageNum - 1) * limitNum;

  // 2. Build MongoDB Query Filter (Enforce APPROVED and NOT SUSPENDED)
  if (checkDBConnection()) {
    const filter = {
      status: 'APPROVED',
      isDeleted: false,
      verificationStatus: { $ne: 'SUSPENDED' },
    };

    // Rent Range Filter
    filter['rent.min'] = { $gte: minRent, $lte: maxRent };

    if (city) filter['address.city'] = new RegExp(city, 'i');
    if (locality) filter['address.locality'] = new RegExp(locality, 'i');
    if (state) filter['address.state'] = new RegExp(state, 'i');
    if (pincode) filter['address.pincode'] = pincode;

    if (searchStr) {
      const sRegex = new RegExp(searchStr, 'i');
      filter.$or = [
        { name: sRegex },
        { 'address.locality': sRegex },
        { 'address.city': sRegex },
        { 'address.state': sRegex },
        { 'address.pincode': sRegex },
      ];
    }

    if (pgType) filter.pgType = pgType;
    if (gender) filter.genderPreference = gender;
    if (furnishing) filter.furnishing = furnishing;
    if (availabilityStatus) filter['availability.status'] = availabilityStatus;
    if (foodAvailable) filter['food.available'] = true;
    if (minRating > 0) filter['ratingSummary.average'] = { $gte: minRating };
    if (onlineBookingOnly) filter.onlineBookingEnabled = { $ne: false };

    if (roomTypesArr.length > 0) {
      filter['roomTypes.type'] = { $in: roomTypesArr };
    }

    if (facilitiesList.length > 0) {
      const facRegexpList = rawFacilities.map((f) => new RegExp(f.trim().replace(/[^a-zA-Z0-9]/g, '.*'), 'i'));
      if (facilityMatching === 'any') {
        filter.facilities = { $in: facRegexpList };
      } else {
        filter.facilities = { $all: facRegexpList };
      }
    }

    // Geospatial Radius Filter
    if (userLat !== null && userLng !== null) {
      filter['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[userLng, userLat], radiusKm / 6378.1],
        },
      };
    }

    // Execute Mongo Query
    const total = await PG.countDocuments(filter);
    let mongoQuery = PG.find(filter).populate('owner', 'name email mobile isVerifiedOwner');

    // Sorting Options
    if (sortOption === 'rent_asc') mongoQuery = mongoQuery.sort({ 'rent.min': 1, createdAt: -1 });
    else if (sortOption === 'rent_desc') mongoQuery = mongoQuery.sort({ 'rent.min': -1, createdAt: -1 });
    else if (sortOption === 'rating_desc') mongoQuery = mongoQuery.sort({ 'ratingSummary.average': -1, createdAt: -1 });
    else if (sortOption === 'newest') mongoQuery = mongoQuery.sort({ createdAt: -1 });
    else mongoQuery = mongoQuery.sort({ 'ratingSummary.average': -1, createdAt: -1 });

    const rawResults = await mongoQuery.skip(skip).limit(limitNum);

    const formatted = rawResults.map((pgObj) => {
      const pg = pgObj.toObject();
      let distKm = null;
      if (userLat !== null && userLng !== null && pg.location) {
        const pgLat = pg.location.latitude || (pg.location.coordinates ? pg.location.coordinates[1] : null);
        const pgLng = pg.location.longitude || (pg.location.coordinates ? pg.location.coordinates[0] : null);
        distKm = calculateHaversineDistance(userLat, userLng, pgLat, pgLng);
      }
      pg.distanceKm = distKm;
      pg.distanceText = formatDistanceText(distKm);
      return pg;
    });

    if (sortOption === 'distance_asc' && userLat !== null && userLng !== null) {
      formatted.sort((a, b) => (a.distanceKm || 9999) - (b.distanceKm || 9999));
    }

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      pgs: formatted,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
    };
  } else {
    // 3. Memory Mode Fallback Filtering Engine (Exclude SUSPENDED)
    let results = memoryPGs.filter(
      (p) => p.status === 'APPROVED' && !p.isDeleted && p.verificationStatus !== 'SUSPENDED'
    );

    if (city) {
      results = results.filter((p) => p.address?.city?.toLowerCase().includes(city.toLowerCase()));
    }
    if (locality) {
      results = results.filter((p) => p.address?.locality?.toLowerCase().includes(locality.toLowerCase()));
    }
    if (state) {
      results = results.filter((p) => p.address?.state?.toLowerCase().includes(state.toLowerCase()));
    }
    if (pincode) {
      results = results.filter((p) => p.address?.pincode === pincode);
    }

    if (searchStr) {
      const s = searchStr.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.address?.city?.toLowerCase().includes(s) ||
          p.address?.locality?.toLowerCase().includes(s) ||
          p.description?.toLowerCase().includes(s)
      );
    }

    // Rent Range
    results = results.filter((p) => {
      const minP = p.rent?.min !== undefined ? p.rent.min : (p.roomTypes && p.roomTypes[0] ? p.roomTypes[0].rent : 0);
      return minP >= minRent && minP <= maxRent;
    });

    if (pgType) results = results.filter((p) => p.pgType === pgType);
    if (gender) results = results.filter((p) => p.genderPreference === gender);
    if (furnishing) results = results.filter((p) => p.furnishing === furnishing);
    if (foodAvailable) results = results.filter((p) => p.food?.available === true);
    if (minRating > 0) results = results.filter((p) => (p.ratingSummary?.average || 0) >= minRating);
    if (onlineBookingOnly) results = results.filter((p) => p.onlineBookingEnabled !== false);

    if (roomTypesArr.length > 0) {
      results = results.filter(
        (p) => p.roomTypes && p.roomTypes.some((r) => roomTypesArr.includes(r.type))
      );
    }

    if (facilitiesList.length > 0) {
      results = results.filter((p) => {
        if (!p.facilities) return false;
        const pFacs = p.facilities.map(normalizeFacilityName);
        if (facilityMatching === 'any') {
          return facilitiesList.some((reqF) => pFacs.some((pf) => pf.includes(reqF) || reqF.includes(pf)));
        }
        return facilitiesList.every((reqF) => pFacs.some((pf) => pf.includes(reqF) || reqF.includes(pf)));
      });
    }

    // Compute Distance & Distance Filter
    results = results.map((pg) => {
      let distKm = null;
      if (userLat !== null && userLng !== null) {
        const pgLat = pg.location?.latitude || (pg.location?.coordinates ? pg.location.coordinates[1] : 28.5355);
        const pgLng = pg.location?.longitude || (pg.location?.coordinates ? pg.location.coordinates[0] : 77.391);
        distKm = calculateHaversineDistance(userLat, userLng, pgLat, pgLng);
      }
      return {
        ...pg,
        distanceKm: distKm,
        distanceText: formatDistanceText(distKm),
      };
    });

    if (userLat !== null && userLng !== null) {
      results = results.filter((p) => p.distanceKm === null || p.distanceKm <= radiusKm);
    }

    // Sort Results
    if (sortOption === 'rent_asc') {
      results.sort((a, b) => (a.rent?.min || 0) - (b.rent?.min || 0));
    } else if (sortOption === 'rent_desc') {
      results.sort((a, b) => (b.rent?.min || 0) - (a.rent?.min || 0));
    } else if (sortOption === 'rating_desc') {
      results.sort((a, b) => (b.ratingSummary?.average || 0) - (a.ratingSummary?.average || 0));
    } else if (sortOption === 'distance_asc') {
      results.sort((a, b) => (a.distanceKm || 9999) - (b.distanceKm || 9999));
    } else if (sortOption === 'newest') {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      // Relevance Ranking score (Includes verification boost & rating weight)
      results.sort((a, b) => {
        const scoreA = (a.ratingSummary?.average || 0) * 3 + (a.isVerifiedPG ? 4 : 0) + (a.owner?.isVerifiedOwner ? 2 : 0);
        const scoreB = (b.ratingSummary?.average || 0) * 3 + (b.isVerifiedPG ? 4 : 0) + (b.owner?.isVerifiedOwner ? 2 : 0);
        return scoreB - scoreA;
      });
    }

    const total = results.length;
    const paginated = results.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      pgs: paginated,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
    };
  }
};

/**
 * Weighted Recommendation Score Calculator
 */
const getRecommendations = async (params = {}, memoryPGsParam = []) => {
  const { city = '', locality = '', maxRent = 25000, gender = '', roomType = '', facilities = [] } = params;

  const searchRes = await searchPGs({ status: 'APPROVED', limit: 50 }, memoryPGsParam);
  let pgs = searchRes.pgs || [];

  const reqFacs = (Array.isArray(facilities) ? facilities : (facilities || '').split(','))
    .map(normalizeFacilityName)
    .filter(Boolean);

  pgs = pgs.map((pg) => {
    let score = 0;

    // 1. Location Match (Up to 25 points)
    if (locality && pg.address?.locality?.toLowerCase().includes(locality.toLowerCase())) {
      score += 25;
    } else if (city && pg.address?.city?.toLowerCase().includes(city.toLowerCase())) {
      score += 15;
    }

    // 2. Budget Match (Up to 20 points)
    const minP = pg.rent?.min || 0;
    if (minP > 0 && minP <= parseInt(maxRent)) {
      score += 20;
    } else if (minP > 0 && minP <= parseInt(maxRent) * 1.2) {
      score += 10;
    }

    // 3. Gender Match (Up to 15 points)
    if (gender && pg.genderPreference === gender.toUpperCase()) {
      score += 15;
    } else if (pg.genderPreference === 'UNISEX') {
      score += 10;
    }

    // 4. Room Type Match (Up to 15 points)
    if (roomType && pg.roomTypes?.some((r) => r.type === roomType.toUpperCase())) {
      score += 15;
    }

    // 5. Facility Coverage (Up to 15 points)
    if (reqFacs.length > 0 && pg.facilities) {
      const pFacs = pg.facilities.map(normalizeFacilityName);
      const matchedCount = reqFacs.filter((f) => pFacs.some((pf) => pf.includes(f))).length;
      score += Math.min(15, Math.round((matchedCount / reqFacs.length) * 15));
    }

    // 6. Admin Verification Boost (10 points)
    if (pg.isVerifiedPG || pg.status === 'APPROVED') {
      score += 10;
    }

    return {
      ...pg,
      recommendationScore: score,
    };
  });

  pgs.sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0));

  return pgs.slice(0, 10);
};

/**
 * Similar PGs Engine
 */
const getSimilarPGs = async (targetPgId, memoryPGsParam = []) => {
  const searchRes = await searchPGs({ status: 'APPROVED', limit: 50 }, memoryPGsParam);
  const allPgs = searchRes.pgs || [];
  const target = allPgs.find((p) => (p._id || p.id) === targetPgId);

  if (!target) return allPgs.slice(0, 4);

  const targetCity = target.address?.city || '';
  const targetRent = target.rent?.min || 10000;

  const similar = allPgs
    .filter((p) => (p._id || p.id) !== targetPgId)
    .map((p) => {
      let score = 0;
      if (p.address?.city?.toLowerCase() === targetCity.toLowerCase()) score += 30;
      if (p.address?.locality?.toLowerCase() === target.address?.locality?.toLowerCase()) score += 20;
      const rDiff = Math.abs((p.rent?.min || 0) - targetRent);
      if (rDiff <= 3000) score += 20;
      if (p.genderPreference === target.genderPreference) score += 15;
      return { ...p, similarityScore: score };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore);

  return similar.slice(0, 4);
};

module.exports = {
  searchPGs,
  getAutocompleteSuggestions,
  calculateHaversineDistance,
  formatDistanceText,
  normalizeFacilityName,
  getRecommendations,
  getSimilarPGs,
};
