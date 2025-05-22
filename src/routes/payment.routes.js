const express = require('express');
const { body } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Process a payment
router.post(
  '/process',
  [
    body('rideId').isMongoId().withMessage('Valid ride ID is required'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string')
  ],
  paymentController.processPayment
);

// Get payment history
router.get('/history', paymentController.getPaymentHistory);

// Get receipt for a ride
router.get('/receipt/:rideId', paymentController.getReceipt);

// Add a tip to a completed ride
router.post(
  '/tip',
  [
    body('rideId').isMongoId().withMessage('Valid ride ID is required'),
    body('tipAmount').isNumeric().withMessage('Tip amount must be a number')
  ],
  paymentController.addTip
);

module.exports = router; 