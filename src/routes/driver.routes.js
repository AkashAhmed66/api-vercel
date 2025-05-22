const express = require('express');
const { body } = require('express-validator');
const driverController = require('../controllers/driver.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All routes require driver role
router.use(authorize(['driver']));

// Update driver availability
router.put(
  '/availability',
  [
    body('isActive').isBoolean().withMessage('isActive must be a boolean')
  ],
  driverController.updateAvailability
);

// Update driver location
router.put(
  '/location',
  [
    body('latitude').isNumeric().withMessage('Latitude must be a number'),
    body('longitude').isNumeric().withMessage('Longitude must be a number')
  ],
  driverController.updateLocation
);

// Get driver's current ride
router.get('/rides/current', driverController.getCurrentRide);

// Get driver's ride history
router.get('/rides', driverController.getDriverRides);

// Accept a ride
router.put('/rides/:rideId/accept', driverController.acceptRide);

// Arrive at pickup location
router.put('/rides/:rideId/arrive', driverController.arriveAtPickup);

// Start a ride
router.put('/rides/:rideId/start', driverController.startRide);

// Complete a ride
router.put(
  '/rides/:rideId/complete',
  [
    body('actualDistance').optional().isNumeric().withMessage('Actual distance must be a number'),
    body('actualDuration').optional().isNumeric().withMessage('Actual duration must be a number')
  ],
  driverController.completeRide
);

// Get driver stats
router.get('/stats', driverController.getDriverStats);

module.exports = router; 