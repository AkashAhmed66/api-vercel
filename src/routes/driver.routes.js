const express = require('express');
const { body } = require('express-validator');
const driverController = require('../controllers/driver.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Driver registration route (only requires authentication, not driver role)
router.post(
  '/register',
  authenticate,
  [
    body('licenseNumber').trim().not().isEmpty().withMessage('License number is required'),
    body('licenseExpiryDate').isISO8601().withMessage('Valid license expiry date is required'),
    body('vehicleDetails.type').optional().isIn(['sedan', 'suv', 'luxury', 'eco']).withMessage('Valid vehicle type is required'),
    body('vehicleDetails.make').trim().not().isEmpty().withMessage('Vehicle make is required'),
    body('vehicleDetails.model').trim().not().isEmpty().withMessage('Vehicle model is required'),
    body('vehicleDetails.year').isInt({ min: 2010, max: new Date().getFullYear() }).withMessage('Valid vehicle year is required'),
    body('vehicleDetails.color').trim().not().isEmpty().withMessage('Vehicle color is required'),
    body('vehicleDetails.licensePlate').trim().not().isEmpty().withMessage('License plate is required'),
    body('documents.driverLicense').optional().isString().withMessage('Driver license document must be a string'),
    body('documents.vehicleRegistration').optional().isString().withMessage('Vehicle registration document must be a string'),
    body('documents.insurance').optional().isString().withMessage('Insurance document must be a string'),
    body('documents.profilePhoto').optional().isString().withMessage('Profile photo must be a string'),
    body('bankingInfo.accountNumber').optional().isString().withMessage('Account number must be a string'),
    body('bankingInfo.routingNumber').optional().isString().withMessage('Routing number must be a string'),
    body('bankingInfo.taxId').optional().isString().withMessage('Tax ID must be a string')
  ],
  driverController.registerDriver
);

// All routes below require authentication
router.use(authenticate);

// All routes below require driver role
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