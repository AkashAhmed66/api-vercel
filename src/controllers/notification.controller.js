const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

/**
 * Notification Controller
 * 
 * Handles notification-related operations:
 * - Fetching user notifications
 * - Creating notifications
 * - Marking notifications as read
 * - Deleting notifications
 */

/**
 * Get all notifications for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with notifications
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0 } = req.query;
    
    const notifications = await Notification.getUserNotifications(userId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
    
    return res.status(200).json({
      success: true,
      notifications: notifications.map(notification => ({
        id: notification._id,
        title: notification.title,
        body: notification.body,
        time: notification.createdAt,
        read: notification.read,
        type: notification.type,
        relatedId: notification.relatedId,
        data: notification.data
      }))
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not fetch notifications. Please try again later.'
    });
  }
};

/**
 * Create a notification for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with the created notification
 */
exports.createNotification = async (req, res) => {
  try {
    const { userId, title, body, type, relatedId, data } = req.body;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const notification = await Notification.createNotification({
      user: userId,
      title,
      body,
      type: type || 'system',
      relatedId,
      data: data || {}
    });
    
    // Emit the notification via Socket.IO if applicable
    if (req.app.io) {
      req.app.io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        title: notification.title,
        body: notification.body,
        time: notification.createdAt,
        read: notification.read,
        type: notification.type,
        relatedId: notification.relatedId,
        data: notification.data
      });
    }
    
    return res.status(201).json({
      success: true,
      notification: {
        id: notification._id,
        title: notification.title,
        body: notification.body,
        time: notification.createdAt,
        read: notification.read,
        type: notification.type,
        relatedId: notification.relatedId,
        data: notification.data
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not create notification. Please try again later.'
    });
  }
};

/**
 * Mark a notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }
    
    const notification = await Notification.findOne({
      _id: id,
      user: userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    if (notification.read) {
      return res.status(200).json({
        success: true,
        message: 'Notification already marked as read'
      });
    }
    
    await notification.markAsRead();
    
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not mark notification as read. Please try again later.'
    });
  }
};

/**
 * Mark all notifications as read for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const result = await Notification.markAllAsRead(userId);
    
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: result.nModified
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not mark notifications as read. Please try again later.'
    });
  }
};

/**
 * Delete a notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }
    
    const result = await Notification.deleteOne({
      _id: id,
      user: userId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not delete notification. Please try again later.'
    });
  }
};

/**
 * Delete all notifications for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status
 */
exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const result = await Notification.deleteAllForUser(userId);
    
    return res.status(200).json({
      success: true,
      message: 'All notifications deleted',
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not delete notifications. Please try again later.'
    });
  }
};

/**
 * Get unread notification count for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const count = await Notification.getUnreadCount(userId);
    
    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not get unread count. Please try again later.'
    });
  }
};

/**
 * Register device token for push notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status
 */
exports.registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token, platform } = req.body;
    
    if (!token || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Device token and platform are required'
      });
    }
    
    if (!['ios', 'android', 'web'].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be ios, android, or web'
      });
    }
    
    // Update user's device tokens, avoiding duplicates
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Initialize deviceTokens if it doesn't exist
    if (!user.deviceTokens) {
      user.deviceTokens = [];
    }
    
    // Check if token already exists
    const tokenExists = user.deviceTokens.some(
      device => device.token === token && device.platform === platform.toLowerCase()
    );
    
    if (!tokenExists) {
      user.deviceTokens.push({
        token,
        platform: platform.toLowerCase(),
        lastUsed: new Date()
      });
      
      await user.save();
    } else {
      // Update last used timestamp
      await User.updateOne(
        { 
          _id: userId,
          'deviceTokens.token': token,
          'deviceTokens.platform': platform.toLowerCase()
        },
        {
          $set: {
            'deviceTokens.$.lastUsed': new Date()
          }
        }
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully'
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not register device token. Please try again later.'
    });
  }
}; 