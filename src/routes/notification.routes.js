const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const Notification = require('../models/notification.model');

/**
 * Notification Routes
 * 
 * These routes handle notification operations:
 * - GET /api/notifications - Get user's notifications
 * - POST /api/notifications - Create a new notification (admin only)
 * - PUT /api/notifications/:id/read - Mark notification as read
 * - PUT /api/notifications/read-all - Mark all notifications as read
 * - DELETE /api/notifications/:id - Delete a notification
 * - DELETE /api/notifications - Delete all notifications
 * - GET /api/notifications/unread/count - Get unread notification count
 * - POST /api/notifications/device-token - Register device token for push notifications
 */

const router = express.Router();

// Get all notifications for the authenticated user
router.get('/', authenticate, notificationController.getUserNotifications);

// Create a new notification (restricted to admin or system use)
router.post('/', authenticate, notificationController.createNotification);

// Test notification endpoint (for debugging only)
router.post('/test', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { title = 'Test Notification', body = 'This is a test notification', type = 'system' } = req.body;
    
    // Create notification in database
    const notification = await Notification.createNotification({
      user: userId,
      title,
      body,
      type,
      data: { test: true, timestamp: new Date() }
    });
    
    // Emit via Socket.IO if available
    if (req.app.io) {
      req.app.io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        title: notification.title,
        body: notification.body,
        time: notification.createdAt,
        read: notification.read,
        type: notification.type,
        data: notification.data
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Test notification sent',
      notification: {
        id: notification._id,
        title: notification.title,
        body: notification.body
      }
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not send test notification'
    });
  }
});

// Mark a notification as read
router.put('/:id/read', authenticate, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticate, notificationController.markAllAsRead);

// Delete a notification
router.delete('/:id', authenticate, notificationController.deleteNotification);

// Delete all notifications
router.delete('/', authenticate, notificationController.deleteAllNotifications);

// Get unread notification count
router.get('/unread/count', authenticate, notificationController.getUnreadCount);

// Register device token for push notifications
router.post('/device-token', authenticate, notificationController.registerDeviceToken);

module.exports = router; 