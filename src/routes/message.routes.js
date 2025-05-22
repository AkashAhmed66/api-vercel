const express = require('express');
const { body } = require('express-validator');
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('receiverId').notEmpty().withMessage('Receiver ID is required'),
    body('rideId').notEmpty().withMessage('Ride ID is required'),
    body('content').notEmpty().withMessage('Message content is required'),
  ],
  messageController.sendMessage
);

/**
 * @route   GET /api/messages/conversation/:userId
 * @desc    Get conversation with user
 * @access  Private
 */
router.get(
  '/conversation/:userId',
  authenticate,
  messageController.getConversation
);

/**
 * @route   GET /api/messages/ride/:rideId
 * @desc    Get all messages for a ride
 * @access  Private
 */
router.get(
  '/ride/:rideId',
  authenticate,
  messageController.getRideMessages
);

/**
 * @route   PUT /api/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.put(
  '/:messageId/read',
  authenticate,
  messageController.markAsRead
);

/**
 * @route   GET /api/messages/unread
 * @desc    Get unread message count
 * @access  Private
 */
router.get(
  '/unread',
  authenticate,
  messageController.getUnreadCount
);

module.exports = router; 