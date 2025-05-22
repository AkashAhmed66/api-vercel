/**
 * Socket.io event handlers for real-time communication
 */

// Store connected clients
const connectedClients = new Map();
// Store driver locations for quick access
const driverLocations = new Map();
// Store active rides
const activeRides = new Map();

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
      
      if (!senderId || !receiverId || !rideId || !content) {
        socket.emit('message_error', {
          message: 'Missing required message data'
        });
        return;
      }
      
      // In a real implementation, we would save this message to the database
      // Through the API endpoint and then emit the event
      // For now, we'll just emit the event for the chat feature to work
      
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
      }, 5000); // Simulate 5 second search
    });
    
    // Handle driver accepting a ride
    socket.on('driver_accepted', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'driverAccepted';
      activeRides.set(rideId, ride);
      
      io.to(`user:${ride.userId}`).emit('driver_accepted', {
        rideId,
        driverId,
        message: 'Driver has accepted your ride request.'
      });
    });
    
    // Handle driver arriving at pickup location
    socket.on('driver_arrived', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'driverArrived';
      ride.arrivalTime = new Date();
      activeRides.set(rideId, ride);
      
      io.to(`user:${ride.userId}`).emit('driver_arrived', {
        rideId,
        driverId,
        message: 'Your driver has arrived at the pickup location.'
      });
    });
    
    // Handle ride started
    socket.on('ride_started', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'inProgress';
      ride.startTime = new Date();
      activeRides.set(rideId, ride);
      
      io.to(`user:${ride.userId}`).emit('ride_started', {
        rideId,
        driverId,
        message: 'Your ride has started.',
        startTime: ride.startTime
      });
    });
    
    // Handle ride completed
    socket.on('ride_completed', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'completed';
      ride.endTime = new Date();
      activeRides.set(rideId, ride);
      
      io.to(`user:${ride.userId}`).emit('ride_completed', {
        rideId,
        driverId,
        message: 'Your ride has been completed.',
        endTime: ride.endTime,
        fare: ride.estimatedPrice // In a real app, calculate the actual fare
      });
      
      // In a real app, we would store this ride in the database
      // and eventually remove it from the active rides map
      setTimeout(() => {
        activeRides.delete(rideId);
      }, 1000 * 60 * 60); // Remove after an hour
    });
    
    // Handle ride cancellation
    socket.on('cancel_ride', ({ userId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'cancelled';
      ride.cancelTime = new Date();
      ride.cancelledBy = userId === ride.userId ? 'user' : 'driver';
      activeRides.set(rideId, ride);
      
      // Notify the user
      io.to(`user:${ride.userId}`).emit('ride_cancelled', {
        rideId,
        message: 'Your ride has been cancelled.',
        cancelledBy: ride.cancelledBy
      });
      
      // Notify the driver if assigned
      if (ride.driverId) {
        io.to(`user:${ride.driverId}`).emit('ride_cancelled', {
          rideId,
          message: 'Ride has been cancelled.',
          cancelledBy: ride.cancelledBy
        });
      }
      
      // In a real app, we would store this cancelled ride in the database
      // and eventually remove it from the active rides map
      setTimeout(() => {
        activeRides.delete(rideId);
      }, 1000 * 60 * 10); // Remove after 10 minutes
    });
    
    // Handle rating submission
    socket.on('submit_rating', ({ rideId, ratedUserId, raterUserId, score, comment, categories }) => {
      console.log(`Rating submitted for ride ${rideId}: ${raterUserId} rated ${ratedUserId} with ${score} stars`);
      
      // In a real app, we would save this to the database using the API
      // Then emit confirmation events to both users
      
      // Notify the rated user
      io.to(`user:${ratedUserId}`).emit('rating_received', {
        rideId,
        ratedBy: raterUserId,
        score,
        comment: comment || ''
      });
      
      // Confirm to the rater
      socket.emit('rating_confirmed', {
        rideId,
        rated: ratedUserId,
        score
      });
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
          
          // If this is a driver, handle any active rides
          if (socket.userType === 'driver') {
            // Get any rides assigned to this driver
            const driverRides = Array.from(activeRides.values())
              .filter(ride => ride.driverId === socket.userId && ['driverAssigned', 'driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
            
            // Notify users of driver disconnection
            driverRides.forEach(ride => {
              io.to(`user:${ride.userId}`).emit('driver_disconnected', {
                rideId: ride.id,
                driverId: socket.userId,
                message: 'Your driver has disconnected. We are monitoring the situation.'
              });
            });
            
            // Remove driver from available locations
            driverLocations.delete(socket.userId);
          }
        }
      }
    });
  });
};

module.exports = setupSocketEvents; 