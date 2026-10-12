const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { checkDBConnection } = require('../config/db');

// In-Memory User Store for local development when MongoDB service is not running
const memoryUsers = [
  {
    _id: 'usr-mem-001',
    name: 'Aarav Patel',
    email: 'aarav@example.com',
    mobile: '9876543210',
    password: '$2b$10$/P.QcEouMygh8ivKlZSMVe8jnoPYd.VlNb2h.sxdCLGWYdV7BLKA.', // hashed 'Password123'
    role: 'SEEKER',
    profileImage: null,
    isActive: true,
    isVerified: false,
  },
  {
    _id: 'usr-mem-002',
    name: 'Rajesh Sharma',
    email: 'rajesh@example.com',
    mobile: '9876543211',
    password: '$2b$10$/P.QcEouMygh8ivKlZSMVe8jnoPYd.VlNb2h.sxdCLGWYdV7BLKA.',
    role: 'OWNER',
    profileImage: null,
    isActive: true,
    isVerified: true,
  },
  {
    _id: 'usr-mem-003',
    name: 'Platform Admin',
    email: 'admin@example.com',
    mobile: '9876543212',
    password: '$2b$10$/P.QcEouMygh8ivKlZSMVe8jnoPYd.VlNb2h.sxdCLGWYdV7BLKA.',
    role: 'ADMIN',
    profileImage: null,
    isActive: true,
    isVerified: true,
  },
];

/**
 * Helper to generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'pgfinder_super_secret_jwt_key_2026_key',
    { expiresIn: '7d' }
  );
};

/**
 * Helper to send Token response (HttpOnly Cookie + JSON payload)
 */
const sendTokenResponse = (user, statusCode, message, res) => {
  const token = generateToken(user._id || user.id, user.role);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  const safeUser = {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || '',
    role: user.role,
    profileImage: user.profileImage || null,
    isVerified: user.isVerified || false,
    isActive: user.isActive !== undefined ? user.isActive : true,
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message,
      data: {
        token,
        user: safeUser,
      },
    });
};

/**
 * @desc    Register a new User (SEEKER or OWNER)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    const targetRole = role ? role.toUpperCase() : 'SEEKER';
    if (targetRole === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Admin account creation is restricted and cannot be registered publicly.',
      });
    }

    if (!['SEEKER', 'OWNER'].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role selection. Must be SEEKER or OWNER.',
      });
    }

    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain both letters and numbers.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (checkDBConnection()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        mobile: mobile ? mobile.trim() : '',
        password,
        role: targetRole,
      });

      return sendTokenResponse(user, 201, 'Registration successful', res);
    } else {
      const existingMemUser = memoryUsers.find((u) => u.email === normalizedEmail);
      if (existingMemUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newMemUser = {
        _id: `usr-mem-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        mobile: mobile ? mobile.trim() : '',
        password: hashedPassword,
        role: targetRole,
        profileImage: null,
        isActive: true,
        isVerified: false,
      };

      memoryUsers.push(newMemUser);
      return sendTokenResponse(newMemUser, 201, 'Registration successful', res);
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }
    next(error);
  }
};

/**
 * @desc    Login User
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (checkDBConnection()) {
      const user = await User.findOne({ email: normalizedEmail }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      return sendTokenResponse(user, 200, 'Login successful', res);
    } else {
      const memUser = memoryUsers.find((u) => u.email === normalizedEmail);

      if (!memUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      if (!memUser.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      const isMatch = await bcrypt.compare(password, memUser.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      return sendTokenResponse(memUser, 200, 'Login successful', res);
    }
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {},
  });
};

const getMe = async (req, res) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    message: 'Current authenticated user profile',
    data: {
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || '',
        role: user.role,
        profileImage: user.profileImage || null,
        isVerified: user.isVerified || false,
        isActive: user.isActive !== undefined ? user.isActive : true,
      },
    },
  });
};

const findMemoryUserById = (userId) => {
  return memoryUsers.find((u) => (u._id || u.id) === userId);
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  findMemoryUserById,
};
