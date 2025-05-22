const express = require('express');
const { body } = require('express-validator');
const rideController = require('../controllers/ride.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get available ride options
router.get('/options', rideController.getRideOptions);

// Estimate ride price
router.post(
  '/estimate',
  [
    body('pickupLocation').isObject().withMessage('Pickup location is required'),
    body('pickupLocation.latitude').isNumeric().withMessage('Pickup latitude must be a number'),
    body('pickupLocation.longitude').isNumeric().withMessage('Pickup longitude must be a number'),
    body('pickupLocation.address').isString().withMessage('Pickup address is required'),
    
    body('dropoffLocation').isObject().withMessage('Dropoff location is required'),
    body('dropoffLocation.latitude').isNumeric().withMessage('Dropoff latitude must be a number'),
    body('dropoffLocation.longitude').isNumeric().withMessage('Dropoff longitude must be a number'),
    body('dropoffLocation.address').isString().withMessage('Dropoff address is required'),
    
    body('distance').isNumeric().withMessage('Distance must be a number'),
    body('duration').isNumeric().withMessage('Duration must be a number'),
    body('rideType').optional().isString().withMessage('Ride type must be a string')
  ],
  rideController.estimateRide
);

// Request a ride
router.post(
  '/request',
  [
    body('pickupLocation').isObject().withMessage('Pickup location is required'),
    body('pickupLocation.latitude').isNumeric().withMessage('Pickup latitude must be a number'),
    body('pickupLocation.longitude').isNumeric().withMessage('Pickup longitude must be a number'),
    body('pickupLocation.address').isString().withMessage('Pickup address is required'),
    
    body('dropoffLocation').isObject().withMessage('Dropoff location is required'),
    body('dropoffLocation.latitude').isNumeric().withMessage('Dropoff latitude must be a number'),
    body('dropoffLocation.longitude').isNumeric().withMessage('Dropoff longitude must be a number'),
    body('dropoffLocation.address').isString().withMessage('Dropoff address is required'),
    
    body('estimatedPrice').isNumeric().withMessage('Estimated price must be a number'),
    body('rideType').optional().isString().withMessage('Ride type must be a string'),
    body('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
    body('scheduledTime').optional().isISO8601().withMessage('Scheduled time must be a valid date'),
    body('isScheduled').optional().isBoolean().withMessage('isScheduled must be a boolean'),
    body('isRecurring').optional().isBoolean().withMessage('isRecurring must be a boolean'),
    body('recurringDays').optional().isArray().withMessage('recurringDays must be an array'),
    body('promoCode').optional().isString().withMessage('Promo code must be a string')
  ],
  rideController.requestRide
);

// Cancel a ride
router.put(
  '/:rideId/cancel',
  [
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  rideController.cancelRide
);

// Get user's ride history
router.get('/history', rideController.getRideHistory);

// Get scheduled rides
router.get('/scheduled', rideController.getScheduledRides);

// Get ride by ID
router.get('/:rideId', rideController.getRideById);

// Rate a ride
router.post(
  '/:rideId/rate',
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString().withMessage('Comment must be a string')
  ],
  rideController.rateRide
);

module.exports = router; 