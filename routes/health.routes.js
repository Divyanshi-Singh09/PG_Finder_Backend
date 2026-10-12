const express = require('express');
const router = express.Router();
const { checkDBConnection } = require('../config/db');

const startTime = Date.now();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint for production uptime monitoring
 * @access  Public
 */
router.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'ok',
    success: true,
    message: 'PGFinder API is operational',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe endpoint
 * @access  Public
 */
router.get('/health/ready', (req, res) => {
  const dbConnected = checkDBConnection();
  res.status(200).json({
    status: 'ready',
    success: true,
    databaseStatus: dbConnected ? 'CONNECTED' : 'LOCAL_IN_MEMORY_DEV',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
