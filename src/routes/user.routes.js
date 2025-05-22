const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Update user profile
router.put(
  '/profile',
  [
    body('name').optional().trim().not().isEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().not().isEmpty().withMessage('Phone cannot be empty'),
    body('profilePic').optional().trim().not().isEmpty().withMessage('Profile picture URL cannot be empty')
  ],
  userController.updateProfile
);

// Add a saved place
router.post(
  '/places',
  [
    body('name').trim().not().isEmpty().withMessage('Place name is required'),
    body('address').trim().not().isEmpty().withMessage('Address is required'),
    body('latitude').isNumeric().withMessage('Latitude must be a number'),
    body('longitude').isNumeric().withMessage('Longitude must be a number')
  ],
  userController.addSavedPlace
);

// Remove a saved place
router.delete('/places/:placeId', userController.removeSavedPlace);

// Add a payment method
router.post(
  '/payment-methods',
  [
    body('type')
      .isIn(['credit_card', 'debit_card', 'bank_account', 'paypal', 'cash'])
      .withMessage('Invalid payment method type'),
    body('cardNumber')
      .if(body('type').isIn(['credit_card', 'debit_card']))
      .trim()
      .not()
      .isEmpty()
      .withMessage('Card number is required for card payments'),
    body('cardHolderName')
      .if(body('type').isIn(['credit_card', 'debit_card']))
      .trim()
      .not()
      .isEmpty()
      .withMessage('Card holder name is required for card payments'),
    body('expiryMonth')
      .if(body('type').isIn(['credit_card', 'debit_card']))
      .isInt({ min: 1, max: 12 })
      .withMessage('Expiry month must be between 1 and 12'),
    body('expiryYear')
      .if(body('type').isIn(['credit_card', 'debit_card']))
      .isInt({ min: new Date().getFullYear() })
      .withMessage('Expiry year must be in the future')
  ],
  userController.addPaymentMethod
);

// Remove a payment method
router.delete('/payment-methods/:methodId', userController.removePaymentMethod);

// Set default payment method
router.put('/payment-methods/:methodId/default', userController.setDefaultPaymentMethod);

// Change password
router.put(
  '/password',
  [
    body('currentPassword').not().isEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
  ],
  userController.changePassword
);

module.exports = router; 