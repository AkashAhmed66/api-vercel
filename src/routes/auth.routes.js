const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Register a new user
router.post(
  '/register',
  [
    body('name')
      .trim()
      .not()
      .isEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email')
      .normalizeEmail()
      .custom(async (email) => {
        const User = require('../models/user.model');
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error('Email is already registered');
        }
        return true;
      }),
    body('password')
      .isLength({ min: 6, max: 128 })
      .withMessage('Password must be between 6 and 128 characters'),
    body('phone')
      .trim()
      .not()
      .isEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone()
      .withMessage('Please enter a valid phone number'),
    body('role')
      .optional()
      .isIn(['user', 'rider', 'driver'])
      .withMessage('Invalid role specified')
  ],
  authController.register
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').not().isEmpty().withMessage('Password is required')
  ],
  authController.login
);

// Get current user profile
router.get('/me', authenticate, authController.getCurrentUser);

// Logout user
router.post('/logout', authenticate, authController.logout);

// Request password reset
router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Please enter a valid email')
  ],
  authController.forgotPassword
);

// Reset password with token
router.post(
  '/reset-password',
  [
    body('token').not().isEmpty().withMessage('Token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],
  authController.resetPassword
);

// Verify email with token
router.post(
  '/verify-email',
  [
    body('token').not().isEmpty().withMessage('Token is required')
  ],
  authController.verifyEmail
);

module.exports = router; 