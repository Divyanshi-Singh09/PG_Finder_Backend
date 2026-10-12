const Facility = require('../models/Facility');
const { checkDBConnection } = require('../config/db');

const initialFacilities = [
  { _id: 'fac-1', name: 'Wi-Fi', category: 'BASIC', iconName: 'Wifi', isActive: true },
  { _id: 'fac-2', name: 'AC', category: 'COMFORT', iconName: 'Wind', isActive: true },
  { _id: 'fac-3', name: 'Food', category: 'FOOD', iconName: 'Utensils', isActive: true },
  { _id: 'fac-4', name: 'Laundry', category: 'SERVICES', iconName: 'Shirt', isActive: true },
  { _id: 'fac-5', name: 'CCTV', category: 'SAFETY', iconName: 'Video', isActive: true },
  { _id: 'fac-6', name: 'Parking', category: 'BASIC', iconName: 'Car', isActive: true },
  { _id: 'fac-7', name: 'Power Backup', category: 'BASIC', iconName: 'Zap', isActive: true },
  { _id: 'fac-8', name: 'Housekeeping', category: 'SERVICES', iconName: 'Sparkles', isActive: true },
  { _id: 'fac-9', name: 'Gym', category: 'ENTERTAINMENT', iconName: 'Dumbbell', isActive: true },
  { _id: 'fac-10', name: 'Hot Water', category: 'COMFORT', iconName: 'Flame', isActive: true },
];

let memoryFacilities = [...initialFacilities];

/**
 * @desc    Get all facilities
 * @route   GET /api/facilities
 * @access  Public
 */
const getFacilities = async (req, res, next) => {
  try {
    if (checkDBConnection()) {
      let facilities = await Facility.find({}).sort({ name: 1 });
      if (facilities.length === 0) {
        await Facility.insertMany(initialFacilities.map((f) => ({ name: f.name, category: f.category, iconName: f.iconName, isActive: f.isActive })));
        facilities = await Facility.find({}).sort({ name: 1 });
      }
      return res.status(200).json({ success: true, data: { facilities } });
    } else {
      return res.status(200).json({ success: true, data: { facilities: memoryFacilities } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new facility
 * @route   POST /api/facilities
 * @access  Private (ADMIN)
 */
const createFacility = async (req, res, next) => {
  try {
    const { name, category, iconName } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Facility name is required.' });
    }

    if (checkDBConnection()) {
      const facility = await Facility.create({ name: name.trim(), category: category || 'BASIC', iconName: iconName || 'Check' });
      return res.status(201).json({ success: true, message: 'Facility created successfully.', data: { facility } });
    } else {
      const facility = {
        _id: `fac-${Date.now()}`,
        name: name.trim(),
        category: category || 'BASIC',
        iconName: iconName || 'Check',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      memoryFacilities.push(facility);
      return res.status(201).json({ success: true, message: 'Facility created successfully.', data: { facility } });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update facility status
 * @route   PATCH /api/facilities/:id
 * @access  Private (ADMIN)
 */
const updateFacilityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, name, category } = req.body;

    if (checkDBConnection()) {
      const facility = await Facility.findByIdAndUpdate(id, { isActive, name, category }, { new: true });
      if (!facility) return res.status(404).json({ success: false, message: 'Facility not found.' });
      return res.status(200).json({ success: true, message: 'Facility updated successfully.', data: { facility } });
    } else {
      const idx = memoryFacilities.findIndex((f) => f._id === id || f.id === id);
      if (idx !== -1) {
        if (isActive !== undefined) memoryFacilities[idx].isActive = isActive;
        if (name) memoryFacilities[idx].name = name;
        if (category) memoryFacilities[idx].category = category;
        return res.status(200).json({ success: true, message: 'Facility updated successfully.', data: { facility: memoryFacilities[idx] } });
      }
      return res.status(404).json({ success: false, message: 'Facility not found.' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFacilities,
  createFacility,
  updateFacilityStatus,
};
