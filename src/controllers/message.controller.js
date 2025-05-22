const { validationResult } = require('express-validator');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const Ride = require('../models/ride.model');
const mongoose = require('mongoose');

/**
 * Send a new message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with created message
 */
exports.sendMessage = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { receiverId, rideId, content, attachments } = req.body;
    const senderId = req.user._id;

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Verify ride exists
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }

    // Ensure the sender is either the rider or the driver of this ride
    const isRider = ride.user.toString() === senderId.toString();
    const isDriver = ride.driver && ride.driver.toString() === senderId.toString();

    if (!isRider && !isDriver) {
      return res.status(403).json({ 
        message: 'You are not authorized to send messages for this ride' 
      });
    }

    // Create and save the message
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      ride: rideId,
      content,
      attachments: attachments || []
    });

    await newMessage.save();

    // Populate sender info for the response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name profilePic')
      .populate('receiver', 'name profilePic');

    // Emit socket event for real-time update (handled by the socket middleware)
    if (req.io) {
      req.io.to(`user:${receiverId}`).emit('new_message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

/**
 * Get conversation between current user and another user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Array} Messages in the conversation
 */
exports.getConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    
    // Optional query parameters
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    // Get messages between the two users
    const messages = await Message.getConversation(
      currentUserId,
      otherUserId,
      limit,
      skip
    );
    
    // Mark all messages as read where current user is the receiver
    await Message.updateMany(
      { sender: otherUserId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ message: 'Error getting conversation', error: error.message });
  }
};

/**
 * Get all messages for a specific ride
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Array} Messages for the ride
 */
exports.getRideMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const rideId = req.params.rideId;
    
    // Check if ride exists and user is authorized
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    
    // Verify user is either the rider or driver
    const isRider = ride.user.toString() === currentUserId.toString();
    const isDriver = ride.driver && ride.driver.toString() === currentUserId.toString();
    
    if (!isRider && !isDriver) {
      return res.status(403).json({ 
        message: 'You are not authorized to view messages for this ride' 
      });
    }
    
    // Optional query parameters
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    
    // Get all messages for this ride
    const messages = await Message.find({ ride: rideId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name profilePic')
      .populate('receiver', 'name profilePic');
    
    // Mark messages as read if current user is the receiver
    await Message.updateMany(
      { ride: rideId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error getting ride messages:', error);
    res.status(500).json({ message: 'Error getting ride messages', error: error.message });
  }
};

/**
 * Mark a message as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Updated message
 */
exports.markAsRead = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const currentUserId = req.user._id;
    
    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Ensure the current user is the intended receiver
    if (message.receiver.toString() !== currentUserId.toString()) {
      return res.status(403).json({ 
        message: 'You are not authorized to mark this message as read' 
      });
    }
    
    // Mark as read if not already
    if (!message.isRead) {
      message.isRead = true;
      await message.save();
    }
    
    res.status(200).json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ message: 'Error marking message as read', error: error.message });
  }
};

/**
 * Get unread message count for current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Unread count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Get count of unread messages
    const unreadCount = await Message.countDocuments({
      receiver: currentUserId,
      isRead: false
    });
    
    // Get count by conversation (grouped by sender)
    const unreadByUser = await Message.aggregate([
      {
        $match: {
          receiver: mongoose.Types.ObjectId(currentUserId),
          isRead: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'senderInfo'
        }
      },
      {
        $project: {
          sender: { $arrayElemAt: ['$senderInfo', 0] },
          count: 1
        }
      },
      {
        $project: {
          'sender._id': 1,
          'sender.name': 1,
          'sender.profilePic': 1,
          count: 1
        }
      }
    ]);
    
    res.status(200).json({
      total: unreadCount,
      byUser: unreadByUser
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Error getting unread count', error: error.message });
  }
}; 