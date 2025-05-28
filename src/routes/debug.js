const express = require('express');
const router = express.Router();

// Import the socket data (we need to expose these from socket.js)
// For now, we'll create a simple debug endpoint

/**
 * GET /debug/status
 * Debug endpoint to check server status
 */
router.get('/status', (req, res) => {
  try {
    // Basic server status
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    };

    res.json({
      success: true,
      status,
      message: 'Server is running'
    });
  } catch (error) {
    console.error('Debug status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting server status',
      error: error.message
    });
  }
});

/**
 * GET /debug/socket-info
 * Debug endpoint to check socket connections
 */
router.get('/socket-info', (req, res) => {
  try {
    // This would need to be properly implemented with access to socket data
    res.json({
      success: true,
      message: 'Socket debug info endpoint - implement with socket data access',
      info: {
        note: 'This endpoint needs to be connected to socket.js data'
      }
    });
  } catch (error) {
    console.error('Socket info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting socket info',
      error: error.message
    });
  }
});

module.exports = router; 