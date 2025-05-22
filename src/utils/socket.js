/**
 * Socket.io event handlers for real-time communication
 */
const Notification = require('../models/notification.model');

// Store connected clients
const connectedClients = new Map();
// Store driver locations for quick access
const driverLocations = new Map();
// Store active rides
const activeRides = new Map();

/**
 * Create and send a notification to a user
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - User ID to send notification to
 * @param {Object} notificationData - Notification data
 */
const createAndSendNotification = async (io, userId, notificationData) => {
  try {
    if (!userId || !notificationData.title || !notificationData.body) {
      console.error('Invalid notification data:', { userId, ...notificationData });
      return;
    }
    
    // Create notification in database
    const notification = await Notification.createNotification({
      user: userId,
      title: notificationData.title,
      body: notificationData.body,
      type: notificationData.type || 'system',
      relatedId: notificationData.relatedId || null,
      data: notificationData.data || {}
    });
    
    // Emit to the specific user
    io.to(`user:${userId}`).emit('notification', {
      id: notification._id,
      title: notification.title,
      body: notification.body,
      time: notification.createdAt,
      read: notification.read,
      type: notification.type,
      relatedId: notification.relatedId,
      data: notification.data
    });
    
    console.log(`Notification sent to user ${userId}: ${notification.title}`);
  } catch (error) {
    console.error('Error creating and sending notification:', error);
  }
};

const setupSocketEvents = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Handle user authentication
    socket.on('authenticate', ({ userId, userType }) => {
      if (userId) {
        // Associate socket with user
        connectedClients.set(userId, { 
          socketId: socket.id, 
          userType, // 'user' or 'driver'
          connected: true,
          lastActive: new Date()
        });
        
        socket.userId = userId;
        socket.userType = userType;
        
        console.log(`User ${userId} authenticated as ${userType}`);
        
        // Join specific room based on user type
        socket.join(`${userType}s`); // 'users' or 'drivers' room
        socket.join(`user:${userId}`); // individual user room
        
        // Notify client of successful authentication
        socket.emit('authenticated', { userId, userType });
      }
    });
    
    // Handle location updates from users or drivers
    socket.on('update_location', ({ userId, location }) => {
      if (!userId || !location) return;
      
      const user = connectedClients.get(userId);
      if (!user) return;
      
      // If driver, update driver location in the map
      if (user.userType === 'driver') {
        driverLocations.set(userId, {
          location,
          lastUpdated: new Date()
        });
        
        // Broadcast to any riders assigned to this driver
        const assignedRides = Array.from(activeRides.values())
          .filter(ride => ride.driverId === userId);
        
        assignedRides.forEach(ride => {
          io.to(`user:${ride.userId}`).emit('driver_location_update', {
            rideId: ride.id,
            driverId: userId,
            location
          });
        });
        
        // Also broadcast to admin dashboard if needed
        io.to('admin').emit('driver_location_update', {
          driverId: userId,
          location
        });
      }
    });
    
    // Handle sending messages
    socket.on('send_message', async (messageData) => {
      const { senderId, receiverId, rideId, content, attachments } = messageData;
      
      if (!senderId || !receiverId || !content) {
        socket.emit('message_error', {
          message: 'Missing required message data'
        });
        return;
      }
      
      // In a real implementation, we would save this message to the database
      const newMessage = {
        _id: `msg_${Date.now()}`,
        sender: senderId,
        receiver: receiverId,
        ride: rideId,
        content,
        attachments: attachments || [],
        createdAt: new Date(),
        isRead: false
      };
      
      // Send to the message recipient
      io.to(`user:${receiverId}`).emit('new_message', newMessage);
      
      // Also send back to the sender for confirmation
      socket.emit('message_sent', newMessage);
      
      // Create notification for the recipient
      createAndSendNotification(io, receiverId, {
        title: 'New Message',
        body: content.length > 50 ? content.substring(0, 47) + '...' : content,
        type: 'system',
        relatedId: rideId,
        data: { senderId, messageId: newMessage._id }
      });
    });
    
    // Handle read receipts
    socket.on('mark_message_read', ({ messageId, userId }) => {
      // In a real implementation, we would update the message in the database
      // For now, we'll just emit the event
      
      // Notify the original sender that their message was read
      socket.broadcast.emit('message_read', {
        messageId,
        readBy: userId,
        readAt: new Date()
      });
    });
    
    // Handle ride requests
    socket.on('ride_request', async (rideDetails) => {
      const { userId, pickupLocation, dropoffLocation, rideType, paymentMethod } = rideDetails;
      
      if (!userId || !pickupLocation || !dropoffLocation) {
        socket.emit('ride_request_error', { 
          message: 'Missing required ride details' 
        });
        return;
      }
      
      // Create a new ride request with pending status
      const rideId = `ride_${Date.now()}`;
      const ride = {
        id: rideId,
        userId,
        pickupLocation,
        dropoffLocation,
        rideType,
        paymentMethod,
        status: 'searching',
        requestTime: new Date(),
        estimatedPrice: rideDetails.estimatedPrice || 0
      };
      
      activeRides.set(rideId, ride);
      
      // Emit to the user that we are searching for drivers
      socket.emit('ride_request_received', {
        rideId,
        status: 'searching'
      });
      
      // Create notification for user
      createAndSendNotification(io, userId, {
        title: 'Looking for Drivers',
        body: 'We are looking for drivers in your area.',
        type: 'ride',
        relatedId: rideId,
        data: { status: 'searching' }
      });
      
      // Simulate finding a driver (in a real app, this would use a matching algorithm)
      setTimeout(() => {
        // Get available drivers (in a real app, we would filter by proximity, ratings, etc.)
        const availableDrivers = Array.from(connectedClients.entries())
          .filter(([_, client]) => client.userType === 'driver' && client.connected);
        
        if (availableDrivers.length === 0) {
          // No drivers available
          socket.emit('ride_request_error', { 
            rideId,
            message: 'No drivers available at this time. Please try again.' 
          });
          
          createAndSendNotification(io, userId, {
            title: 'No Drivers Found',
            body: 'We couldn\'t find any available drivers. Please try again later.',
            type: 'ride',
            relatedId: rideId,
            data: { status: 'failed' }
          });
          
          activeRides.delete(rideId);
          return;
        }
        
        // Select a driver (in a real app, this would be based on various factors)
        const [driverId, driverInfo] = availableDrivers[Math.floor(Math.random() * availableDrivers.length)];
        
        // Update ride with driver info
        ride.driverId = driverId;
        ride.status = 'driverAssigned';
        ride.assignedTime = new Date();
        
        // Store updated ride
        activeRides.set(rideId, ride);
        
        // Notify the driver about the ride request
        io.to(`user:${driverId}`).emit('ride_assigned', {
          rideId,
          passengerId: userId,
          pickupLocation,
          dropoffLocation,
          estimatedPrice: ride.estimatedPrice
        });
        
        // Create notification for driver
        createAndSendNotification(io, driverId, {
          title: 'New Ride Request',
          body: `New ride request from ${pickupLocation.address.substring(0, 20)}...`,
          type: 'ride',
          relatedId: rideId,
          data: { 
            passengerId: userId,
            pickupLocation,
            dropoffLocation
          }
        });
        
        // Notify the user that a driver has been assigned
        io.to(`user:${userId}`).emit('driver_assigned', {
          rideId,
          driverId,
          driverName: 'Driver Name', // In a real app, fetch from database
          driverRating: 4.8, // In a real app, fetch from database
          vehicleDetails: {
            model: 'Toyota Camry',
            color: 'Black',
            licensePlate: 'ABC123'
          },
          estimatedArrival: '5 minutes'
        });
        
        // Create notification for user
        createAndSendNotification(io, userId, {
          title: 'Driver Found',
          body: 'A driver has been assigned to your ride request.',
          type: 'ride',
          relatedId: rideId,
          data: { 
            driverId,
            status: 'driverAssigned',
            estimatedArrival: '5 minutes'
          }
        });
      }, 5000); // Simulate 5 second search
    });
    
    // Handle driver accepting a ride
    socket.on('driver_accepted', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'driverAccepted';
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('driver_accepted', {
        rideId,
        driverId,
        message: 'Driver has accepted your ride request.'
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Accepted',
        body: 'A driver has accepted your ride request and is on their way.',
        type: 'ride',
        relatedId: rideId,
        data: { driverId, status: 'accepted' }
      });
    });
    
    // Handle driver arriving at pickup location
    socket.on('driver_arrived', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'driverArrived';
      ride.arrivalTime = new Date();
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('driver_arrived', {
        rideId,
        driverId,
        message: 'Your driver has arrived at the pickup location.'
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Driver Arrived',
        body: 'Your driver has arrived at the pickup location.',
        type: 'ride',
        relatedId: rideId,
        data: { driverId, status: 'arrived' }
      });
    });
    
    // Handle ride started
    socket.on('ride_started', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'inProgress';
      ride.startTime = new Date();
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('ride_started', {
        rideId,
        driverId,
        message: 'Your ride has started.',
        startTime: ride.startTime
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Started',
        body: 'Your ride has started. Enjoy your journey!',
        type: 'ride',
        relatedId: rideId,
        data: { driverId, status: 'started', startTime: ride.startTime }
      });
    });
    
    // Handle ride completed
    socket.on('ride_completed', ({ driverId, rideId, finalFare }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'completed';
      ride.endTime = new Date();
      ride.finalFare = finalFare || ride.estimatedPrice;
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('ride_completed', {
        rideId,
        driverId,
        message: 'Your ride has been completed.',
        endTime: ride.endTime,
        finalFare: ride.finalFare
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Completed',
        body: `Your ride has been completed. Final fare: $${ride.finalFare.toFixed(2)}`,
        type: 'ride',
        relatedId: rideId,
        data: { 
          driverId, 
          status: 'completed',
          endTime: ride.endTime,
          finalFare: ride.finalFare
        }
      });
      
      // After completion, move the ride from active to history
      // This would be handled by the database in a real app
      activeRides.delete(rideId);
    });
    
    // Handle ride cancellation
    socket.on('cancel_ride', ({ userId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      // Only allow cancellation by the rider or the assigned driver
      if (ride.userId !== userId && ride.driverId !== userId) {
        socket.emit('ride_error', {
          rideId,
          message: 'You are not authorized to cancel this ride'
        });
        return;
      }
      
      const cancelledByRider = ride.userId === userId;
      const notifyUserId = cancelledByRider ? ride.driverId : ride.userId;
      
      // Update ride status
      ride.status = 'cancelled';
      ride.cancelTime = new Date();
      ride.cancelledBy = userId;
      activeRides.set(rideId, ride);
      
      // Notify the other party about cancellation
      if (notifyUserId) {
        io.to(`user:${notifyUserId}`).emit('ride_cancelled', {
          rideId,
          cancelledBy: cancelledByRider ? 'rider' : 'driver',
          message: `Ride was cancelled by ${cancelledByRider ? 'rider' : 'driver'}`
        });
        
        // Create notification for the other party
        createAndSendNotification(io, notifyUserId, {
          title: 'Ride Cancelled',
          body: `Your ride has been cancelled by the ${cancelledByRider ? 'rider' : 'driver'}.`,
          type: 'ride',
          relatedId: rideId,
          data: { 
            cancelledBy: cancelledByRider ? 'rider' : 'driver',
            cancelTime: ride.cancelTime
          }
        });
      }
      
      // Confirm cancellation to the party who initiated it
      socket.emit('ride_cancelled_confirmation', {
        rideId,
        status: 'cancelled',
        message: 'Ride has been cancelled successfully'
      });
      
      // Remove from active rides
      setTimeout(() => {
        activeRides.delete(rideId);
      }, 1000 * 60 * 5); // Keep in memory for 5 minutes before removing
    });
    
    // Handle payment processed event
    socket.on('payment_processed', ({ userId, paymentId, amount, method }) => {
      // Send the payment_processed event
      io.to(`user:${userId}`).emit('payment_processed', {
        paymentId,
        amount,
        method,
        timestamp: new Date()
      });
      
      // Create notification for user
      createAndSendNotification(io, userId, {
        title: 'Payment Processed',
        body: `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
        type: 'payment',
        relatedId: paymentId,
        data: { amount, method, timestamp: new Date() }
      });
    });
    
    // Handle promotion notifications
    socket.on('send_promo_notification', ({ userIds, promoCode, description, expiryDate }) => {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        console.error('No users specified for promo notification');
        return;
      }
      
      // For each user in the list, send a notification
      userIds.forEach(userId => {
        // Send the promotion event
        io.to(`user:${userId}`).emit('promo_notification', {
          promoCode,
          description,
          expiryDate
        });
        
        // Create notification for user
        createAndSendNotification(io, userId, {
          title: 'New Promotion Available',
          body: `${description} Use code: ${promoCode}. Expires: ${expiryDate}`,
          type: 'promo',
          data: { promoCode, description, expiryDate }
        });
      });
    });
    
    // Handle system notifications to all users or specific users
    socket.on('send_system_notification', ({ userIds, title, body, data }) => {
      if (!title || !body) {
        console.error('Invalid system notification data');
        return;
      }
      
      // If userIds is provided, send to those specific users
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        userIds.forEach(userId => {
          createAndSendNotification(io, userId, {
            title,
            body,
            type: 'system',
            data
          });
        });
      } 
      // Otherwise broadcast to all connected users
      else {
        // We don't want to create a notification for every user in the system,
        // so we'll just emit the event to all connected clients
        io.emit('system_notification', {
          title,
          body,
          time: new Date(),
          type: 'system',
          data
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.userId) {
        const client = connectedClients.get(socket.userId);
        
        if (client) {
          client.connected = false;
          client.lastActive = new Date();
          connectedClients.set(socket.userId, client);
          
          console.log(`User ${socket.userId} disconnected`);
        }
      }
    });
  });
};

module.exports = { setupSocketEvents, createAndSendNotification }; 