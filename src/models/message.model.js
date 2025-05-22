const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'audio', 'location'],
      default: 'image'
    },
    url: {
      type: String,
      trim: true
    },
    metadata: {
      type: Object,
      default: {}
    }
  }]
}, {
  timestamps: true
});

// Create an index for faster queries
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ ride: 1 });
messageSchema.index({ createdAt: -1 });

// Add method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Add static method to get conversation between two users
messageSchema.statics.getConversation = async function(user1Id, user2Id, limit = 50, skip = 0) {
  return this.find({
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id }
    ]
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name profilePic')
    .populate('receiver', 'name profilePic');
};

// Add static method to get unread message count
messageSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false
  });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 