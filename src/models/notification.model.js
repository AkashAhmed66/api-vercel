const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Notification Schema
 * 
 * This defines the model for user notifications. Notifications can be:
 * - System notifications
 * - Ride related notifications
 * - Payment notifications
 * - Promotional notifications
 * - Driver update notifications
 */

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['ride', 'payment', 'promo', 'system', 'driver_update'],
      default: 'system'
    },
    read: {
      type: Boolean,
      default: false
    },
    relatedId: {
      type: String,
      default: null
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    expiresAt: {
      type: Date,
      default: function() {
        // Default expiration 30 days from creation
        const now = new Date();
        return new Date(now.setDate(now.getDate() + 30));
      }
    }
  },
  {
    timestamps: true
  }
);

// Add indexes for common queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic deletion

// Virtual for time since creation (for frontend "5 min ago" display)
notificationSchema.virtual('timeSince').get(function() {
  return new Date() - this.createdAt;
});

// Instance methods
notificationSchema.methods = {
  /**
   * Mark notification as read
   */
  markAsRead: async function() {
    this.read = true;
    return await this.save();
  }
};

// Static methods
notificationSchema.statics = {
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Notification>}
   */
  createNotification: async function(notificationData) {
    return await this.create(notificationData);
  },

  /**
   * Get all notifications for a user
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options (limit, skip, etc)
   * @returns {Promise<Notification[]>}
   */
  getUserNotifications: async function(userId, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
    
    return await this.find({ user: userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();
  },

  /**
   * Mark all notifications as read for a user
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} - Result of the update operation
   */
  markAllAsRead: async function(userId) {
    return await this.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );
  },

  /**
   * Get unread notification count for a user
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Number>}
   */
  getUnreadCount: async function(userId) {
    return await this.countDocuments({ user: userId, read: false });
  },

  /**
   * Delete all notifications for a user
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Object>} - Result of the delete operation
   */
  deleteAllForUser: async function(userId) {
    return await this.deleteMany({ user: userId });
  }
};

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification; 