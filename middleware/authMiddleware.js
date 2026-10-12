const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { checkDBConnection } = require('../config/db');
const { findMemoryUserById } = require('../controllers/authController');

/**
 * Protect middleware to verify JWT token and attach user to request
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization Bearer header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please log in to access this resource.',
    });
  }

  try {
    // Verify JWT Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pgfinder_super_secret_jwt_key_2026_key');

    let user;
    if (checkDBConnection()) {
      user = await User.findById(decoded.userId).select('-password');
    } else {
      user = findMemoryUserById(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    req.user = {
      id: user._id || user.id,
      _id: user._id || user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile || '',
      role: user.role,
      isVerified: user.isVerified || false,
      isActive: user.isActive !== undefined ? user.isActive : true,
    };

    next();
  } catch (error) {
    console.error(`[Auth Error] JWT Verification failed: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Token invalid or expired.',
    });
  }
};

module.exports = { protect };
