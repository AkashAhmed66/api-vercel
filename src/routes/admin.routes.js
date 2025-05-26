const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

// Get all driver applications
router.get('/drivers/applications', adminController.getDriverApplications);

// Get specific driver details
router.get('/drivers/:driverId', adminController.getDriverDetails);

// Approve driver application
router.put(
  '/drivers/:driverId/approve',
  [
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
  adminController.approveDriverApplication
);

// Reject driver application
router.put(
  '/drivers/:driverId/reject',
  [
    body('reason').not().isEmpty().withMessage('Rejection reason is required')
  ],
  adminController.rejectDriverApplication
);

// Suspend driver
router.put(
  '/drivers/:driverId/suspend',
  [
    body('reason').not().isEmpty().withMessage('Suspension reason is required')
  ],
  adminController.suspendDriver
);

// Reactivate driver
router.put('/drivers/:driverId/reactivate', adminController.reactivateDriver);

module.exports = router; 