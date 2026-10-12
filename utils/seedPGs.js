const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PG = require('../models/PG');
const User = require('../models/User');

dotenv.config();

const sampleApprovedPGs = [
  {
    name: 'Sunrise Premium Co-Living',
    description: 'Modern luxury PG for working professionals and students near metro station with high speed fibre internet, biometric security, and daily housekeeping.',
    pgType: 'CO_LIVING',
    genderPreference: 'ANY',
    contact: { phone: '+91 98765 43210', email: 'owner.sunrise@example.com' },
    address: { houseNumber: 'A-12', street: 'Sector 62 Main Road', locality: 'Sector 62', landmark: 'Near Electronic City Metro', city: 'Noida', state: 'Uttar Pradesh', pincode: '201309' },
    location: { latitude: 28.627, longitude: 77.372 },
    rent: { min: 7500, max: 14000 },
    securityDeposit: 7500,
    roomTypes: [
      { type: 'DOUBLE', rent: 8500, deposit: 8500, totalRooms: 8, availableRooms: 4, amenities: ['AC', 'Wi-Fi', 'Attached Bathroom'] },
      { type: 'SINGLE', rent: 14000, deposit: 14000, totalRooms: 4, availableRooms: 2, amenities: ['AC', 'Wi-Fi', 'TV', 'Study Table'] },
      { type: 'TRIPLE', rent: 7500, deposit: 7500, totalRooms: 6, availableRooms: 3, amenities: ['Wi-Fi', 'Geyser'] }
    ],
    facilities: ['Wi-Fi', 'AC', 'Food', 'Laundry', 'Parking', 'CCTV', 'Power Backup', 'Housekeeping', 'Geyser', 'RO Water', '24x7 Security'],
    food: { available: true, type: 'Both', meals: ['Breakfast', 'Dinner'] },
    rules: ['No Smoking inside rooms', 'Visitors allowed till 8 PM', 'Gate closes at 10:30 PM'],
    images: [
      { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80', isCover: true },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80', isCover: false }
    ],
    availability: { available: true, availableFrom: new Date() },
    status: 'APPROVED',
  },
  {
    name: 'Starlight Girls Haven PG',
    description: 'Safe and peaceful Girls PG with 24x7 biometric security, female warden, home-style vegetarian food, and attached balconies.',
    pgType: 'GIRLS',
    genderPreference: 'FEMALE',
    contact: { phone: '+91 98765 43211', email: 'owner.starlight@example.com' },
    address: { houseNumber: 'B-88', street: 'Cyber City Avenue', locality: 'Sector 44', landmark: 'Opposite Amity University', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
    location: { latitude: 28.544, longitude: 77.333 },
    rent: { min: 9000, max: 16000 },
    securityDeposit: 9000,
    roomTypes: [
      { type: 'DOUBLE', rent: 9500, deposit: 9500, totalRooms: 10, availableRooms: 5, amenities: ['AC', 'Wi-Fi', 'Balcony'] },
      { type: 'SINGLE', rent: 16000, deposit: 16000, totalRooms: 3, availableRooms: 1, amenities: ['AC', 'Wi-Fi', 'Fridge'] }
    ],
    facilities: ['Wi-Fi', 'AC', 'Food', 'Laundry', 'CCTV', 'Power Backup', 'Housekeeping', 'Geyser', 'RO Water', 'Biometric Security'],
    food: { available: true, type: 'Vegetarian', meals: ['Breakfast', 'Lunch', 'Dinner'] },
    rules: ['Female occupants only', 'Gate closes at 10 PM', 'No Alcohol allowed'],
    images: [
      { url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80', isCover: true }
    ],
    availability: { available: true, availableFrom: new Date() },
    status: 'APPROVED',
  },
  {
    name: 'Silicon Valley Boys Executive PG',
    description: 'Premium Boys PG located close to IT hubs, featuring gaming common room, gym access, power backup, and laundry service.',
    pgType: 'BOYS',
    genderPreference: 'MALE',
    contact: { phone: '+91 98765 43212', email: 'owner.silicon@example.com' },
    address: { houseNumber: 'C-21', street: 'HSR Layout Sector 1', locality: 'HSR Layout', landmark: 'Near NIFT College', city: 'Bangalore', state: 'Karnataka', pincode: '560102' },
    location: { latitude: 12.912, longitude: 77.644 },
    rent: { min: 8000, max: 15000 },
    securityDeposit: 8000,
    roomTypes: [
      { type: 'DOUBLE', rent: 9000, deposit: 9000, totalRooms: 12, availableRooms: 6, amenities: ['AC', 'Wi-Fi'] },
      { type: 'TRIPLE', rent: 8000, deposit: 8000, totalRooms: 6, availableRooms: 4, amenities: ['Wi-Fi'] },
      { type: 'SINGLE', rent: 15000, deposit: 15000, totalRooms: 4, availableRooms: 2, amenities: ['AC', 'Wi-Fi', 'TV'] }
    ],
    facilities: ['Wi-Fi', 'AC', 'Food', 'Laundry', 'Parking', 'CCTV', 'Power Backup', 'Gym', 'Common Area'],
    food: { available: true, type: 'Both', meals: ['Breakfast', 'Dinner'] },
    rules: ['Male occupants only', 'ID proof mandatory', 'No smoking inside rooms'],
    images: [
      { url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80', isCover: true }
    ],
    availability: { available: true, availableFrom: new Date() },
    status: 'APPROVED',
  },
  {
    name: 'Cyber Residency Co-Living',
    description: 'Fully furnished co-living home with high-speed internet, dedicated workstation desks, rooftop lounge, and 24x7 security.',
    pgType: 'CO_LIVING',
    genderPreference: 'ANY',
    contact: { phone: '+91 98765 43213', email: 'owner.cyber@example.com' },
    address: { houseNumber: 'D-55', street: 'DLF Phase 3', locality: 'Cyber City', landmark: 'Near IndusInd Bank Metro', city: 'Gurugram', state: 'Haryana', pincode: '122002' },
    location: { latitude: 28.495, longitude: 77.089 },
    rent: { min: 11000, max: 20000 },
    securityDeposit: 11000,
    roomTypes: [
      { type: 'SINGLE', rent: 20000, deposit: 20000, totalRooms: 5, availableRooms: 2, amenities: ['AC', 'Wi-Fi', 'Workstation'] },
      { type: 'DOUBLE', rent: 11000, deposit: 11000, totalRooms: 10, availableRooms: 4, amenities: ['AC', 'Wi-Fi'] }
    ],
    facilities: ['Wi-Fi', 'AC', 'Food', 'Laundry', 'Parking', 'CCTV', 'Power Backup', 'Lift', 'Gym', 'Common Area'],
    food: { available: true, type: 'Both', meals: ['Breakfast', 'Lunch', 'Dinner'] },
    rules: ['Notice period: 30 days', 'Visitors allowed till 9 PM'],
    images: [
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80', isCover: true }
    ],
    availability: { available: true, availableFrom: new Date() },
    status: 'APPROVED',
  }
];

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pgfinder';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('[Seed] Connected to MongoDB');

    let ownerUser = await User.findOne({ role: 'OWNER' });
    if (!ownerUser) {
      ownerUser = await User.create({
        name: 'Seed Owner',
        email: 'seedowner@example.com',
        mobile: '9876543210',
        password: 'Password123',
        role: 'OWNER',
        isVerified: true,
      });
    }

    // Insert or update sample approved PGs
    for (const pgItem of sampleApprovedPGs) {
      await PG.findOneAndUpdate(
        { name: pgItem.name },
        { ...pgItem, owner: ownerUser._id },
        { upsert: true, new: true }
      );
    }

    console.log('[Seed] Successfully seeded approved PGs for public seeker discovery.');
    process.exit(0);
  } catch (error) {
    console.log(`[Seed Note] Could not seed MongoDB directly: ${error.message}`);
    process.exit(0);
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = { sampleApprovedPGs };
