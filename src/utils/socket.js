/**
 * Socket.io event handlers for real-time communication
 */
const Ride = require('../models/ride.model');
const Notification = require('../models/notification.model');

// Store connected clients
const connectedClients = new Map();
// Store driver locations for quick access
const driverLocations = new Map();
// Store active rides
const activeRides = new Map();
// Store driver movement history for ride tracking
const driverMovementHistory = new Map();

// Constants for fare calculation
const FARE_PER_KM = 20; // 20 taka per kilometer

/**
 * Calculate distance between two coordinates in kilometers (using Haversine formula)
 * @param {Object} coord1 - First coordinate {latitude, longitude}
 * @param {Object} coord2 - Second coordinate {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coord2.latitude - coord1.latitude);
  const dLon = deg2rad(coord2.longitude - coord1.longitude); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(coord1.latitude)) * Math.cos(deg2rad(coord2.latitude)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

/**
 * Calculate fare based on distance
 * @param {number} distance - Distance in kilometers
 * @returns {number} Fare in taka
 */
const calculateFare = (distance) => {
  return Math.round(distance * FARE_PER_KM);
};

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

/**
 * Update driver's movement history and notify rider
 * @param {Object} io - Socket.IO instance
 * @param {string} driverId - Driver ID
 * @param {Object} location - Current location {latitude, longitude}
 * @param {Object} ride - Current ride object
 */
const updateDriverMovement = (io, driverId, location, ride) => {
  // Get or initialize driver movement history
  if (!driverMovementHistory.has(driverId)) {
    driverMovementHistory.set(driverId, []);
  }
  
  const history = driverMovementHistory.get(driverId);
  const timestamp = new Date();
  
  // Add location to history with timestamp
  history.push({
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp
  });
  
  // Keep only the last 100 positions to manage memory
  if (history.length > 100) {
    history.shift();
  }
  
  // Update the history
  driverMovementHistory.set(driverId, history);
  
  // If this driver has an active ride, update the route in the ride
  if (ride) {
    // Add this location to the ride's route
    if (!ride.route) {
      ride.route = [];
    }
    
    ride.route.push({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp
    });
    
    activeRides.set(ride.id, ride);
    
    // Calculate distance and update estimated fare if needed
    if (history.length >= 2) {
      const prevLocation = history[history.length - 2];
      const currentLocation = history[history.length - 1];
      
      const segmentDistance = calculateDistance(
        prevLocation, 
        currentLocation
      );
      
      // If we moved a significant distance (more than 10 meters)
      if (segmentDistance > 0.01) {
        // Update total distance for the ride
        ride.actualDistance = (ride.actualDistance || 0) + segmentDistance;
        
        // Update fare based on actual distance
        const updatedFare = calculateFare(ride.actualDistance);
        ride.updatedFare = updatedFare;
        
        activeRides.set(ride.id, ride);
      }
    }
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
        
        // If this is a driver, check if they have any active rides
        if (userType === 'driver') {
          const activeRide = Array.from(activeRides.values())
            .find(ride => ride.driverId === userId && 
                  ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
          
          if (activeRide) {
            // Send the active ride to the driver
            socket.emit('active_ride_status', activeRide);
          }
        }
        
        // If this is a user (rider), check if they have any active rides
        if (userType === 'user') {
          const activeRide = Array.from(activeRides.values())
            .find(ride => ride.userId === userId && 
                  ['searching', 'driverAssigned', 'driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
          
          if (activeRide) {
            // Send the active ride to the user
            socket.emit('active_ride_status', activeRide);
            
            // If a driver is assigned, also send the latest driver location
            if (activeRide.driverId && driverLocations.has(activeRide.driverId)) {
              const driverLocation = driverLocations.get(activeRide.driverId);
              
              socket.emit('driver_location_update', {
                rideId: activeRide.id,
                driverId: activeRide.driverId,
                location: driverLocation.location,
                lastUpdated: driverLocation.lastUpdated
              });
              
              // Also send driver movement history if available
              if (driverMovementHistory.has(activeRide.driverId)) {
                const history = driverMovementHistory.get(activeRide.driverId);
                if (history.length > 0) {
                  socket.emit('driver_movement_history', {
                    rideId: activeRide.id,
                    driverId: activeRide.driverId,
                    history
                  });
                }
              }
            }
          }
        }
      }
    });

    // Handle driver connection
    socket.on('driver_connect', ({ driverId, location, isOnline }) => {
      if (driverId) {
        // Associate socket with driver
        connectedClients.set(driverId, { 
          socketId: socket.id, 
          userType: 'driver',
          connected: true,
          isOnline: isOnline || false,
          location: location || null,
          lastActive: new Date()
        });
        
        socket.userId = driverId;
        socket.userType = 'driver';
        
        console.log(`Driver ${driverId} connected - ${isOnline ? 'Online' : 'Offline'}`);
        
        // Join driver rooms
        socket.join('drivers');
        socket.join(`user:${driverId}`);
        
        // Update driver location if provided
        if (location) {
          driverLocations.set(driverId, {
            location,
            lastUpdated: new Date()
          });
        }
        
        // Notify client of successful connection
        socket.emit('driver_connected', { driverId, isOnline });
        
        // If going online, check for any pending ride requests
        if (isOnline) {
          console.log(`Driver ${driverId} is now online and available for rides`);
        }
      }
    });

    // Handle driver disconnect
    socket.on('driver_disconnect', ({ driverId }) => {
      if (driverId && connectedClients.has(driverId)) {
        const client = connectedClients.get(driverId);
        client.connected = false;
        client.isOnline = false;
        connectedClients.set(driverId, client);
        
        console.log(`Driver ${driverId} disconnected`);
      }
    });

    // Handle driver status updates
    socket.on('driver_status_update', ({ driverId, isOnline, location }) => {
      if (driverId && connectedClients.has(driverId)) {
        const client = connectedClients.get(driverId);
        const wasOnline = client.isOnline;
        
        client.isOnline = isOnline;
        client.location = location;
        client.lastActive = new Date();
        connectedClients.set(driverId, client);
        
        // Update driver location
        if (location) {
          driverLocations.set(driverId, {
            location,
            lastUpdated: new Date()
          });
        }
        
        console.log(`Driver ${driverId} status updated - ${isOnline ? 'Online' : 'Offline'}`);
        
        // If driver went offline, check if they have active rides
        if (wasOnline && !isOnline) {
          const activeRide = Array.from(activeRides.values())
            .find(ride => ride.driverId === driverId && 
                  ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
          
          if (activeRide) {
            // Notify passenger that driver went offline
            io.to(`user:${activeRide.userId}`).emit('driver_offline', {
              rideId: activeRide.id,
              driverId,
              message: 'Your driver has gone offline. We are finding you a new driver.'
            });
            
            console.log(`Driver ${driverId} went offline with active ride ${activeRide.id}`);
          }
        }
        
        // Confirm status update to driver
        socket.emit('driver_status_updated', { 
          driverId, 
          isOnline,
          message: `You are now ${isOnline ? 'online and available for rides' : 'offline'}`
        });
      }
    });

    // Handle driver location updates
    socket.on('driver_location_update', ({ driverId, location, timestamp }) => {
      if (driverId && location) {
        driverLocations.set(driverId, {
          location,
          lastUpdated: new Date(timestamp || Date.now())
        });
        
        // Update client info
        if (connectedClients.has(driverId)) {
          const client = connectedClients.get(driverId);
          client.location = location;
          client.lastActive = new Date();
          connectedClients.set(driverId, client);
        }
        
        // Find any active ride assigned to this driver and update rider
        const activeRide = Array.from(activeRides.values())
          .find(ride => ride.driverId === driverId && 
                ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
        
        if (activeRide) {
          updateDriverMovement(io, driverId, location, activeRide);
          
          // Broadcast to the rider
          io.to(`user:${activeRide.userId}`).emit('driver_location_update', {
            rideId: activeRide.id,
            driverId,
            location,
            lastUpdated: new Date()
          });
        }
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
        
        // Find any active ride assigned to this driver
        const activeRide = Array.from(activeRides.values())
          .find(ride => ride.driverId === userId && 
                ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
        
        // Update driver movement history and notify rider
        if (activeRide) {
          updateDriverMovement(io, userId, location, activeRide);
          
          // Broadcast to the rider assigned to this driver
          io.to(`user:${activeRide.userId}`).emit('driver_location_update', {
            rideId: activeRide.id,
            driverId: userId,
            location,
            lastUpdated: new Date()
          });
          
          // If fare was updated, also send fare update
          if (activeRide.updatedFare) {
            io.to(`user:${activeRide.userId}`).emit('fare_update', {
              rideId: activeRide.id,
              fare: activeRide.updatedFare,
              distance: activeRide.actualDistance
            });
          }
        }
        
        // Also broadcast to admin dashboard if needed
        io.to('admin').emit('driver_location_update', {
          driverId: userId,
          location,
          lastUpdated: new Date()
        });
      } else {
        // User/rider location updates are only relevant during active rides
        const activeRide = Array.from(activeRides.values())
          .find(ride => ride.userId === userId && 
                ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
        
        if (activeRide && activeRide.driverId) {
          // Send rider location to the assigned driver
          io.to(`user:${activeRide.driverId}`).emit('rider_location_update', {
            rideId: activeRide.id,
            userId,
            location,
            lastUpdated: new Date()
          });
        }
      }
    });
    
    // Request driver's movement history
    socket.on('request_driver_movement', ({ rideId, driverId }) => {
      if (!rideId || !driverId) return;
      
      // Check if this ride exists and belongs to the requesting user
      const ride = activeRides.get(rideId);
      if (!ride || ride.userId !== socket.userId) return;
      
      // Get driver movement history
      const history = driverMovementHistory.get(driverId) || [];
      
      // Send movement history to rider
      socket.emit('driver_movement_history', {
        rideId,
        driverId,
        history
      });
    });
    
    // Handle ride requests
    socket.on('ride_request', async (rideDetails) => {
      const { 
        userId, 
        pickupLocation, 
        dropoffLocation, 
        rideType, 
        paymentMethod, 
        estimatedPrice,
        estimatedDistance,
        vehicleDetails 
      } = rideDetails;
      
      if (!userId || !pickupLocation || !dropoffLocation) {
        socket.emit('ride_request_error', { 
          message: 'Missing required ride details' 
        });
        return;
      }

      // Calculate distance if not provided
      const distance = estimatedDistance || calculateDistance(pickupLocation, dropoffLocation);
      const finalEstimatedPrice = estimatedPrice || calculateFare(distance);
      
      // Create a new ride request with pending status
      const rideId = `ride_${Date.now()}_${userId}`;
      const ride = {
        id: rideId,
        userId,
        pickupLocation,
        dropoffLocation,
        rideType: rideType || 'standard',
        paymentMethod: paymentMethod || 'cash',
        vehicleDetails,
        status: 'searching',
        requestTime: new Date(),
        estimatedDistance: distance,
        estimatedPrice: finalEstimatedPrice,
        currency: 'BDT' // Bangladeshi Taka
      };
      
      activeRides.set(rideId, ride);
      
      console.log(`New ride request ${rideId} from user ${userId}:`, {
        from: pickupLocation.address,
        to: dropoffLocation.address,
        type: rideType,
        price: finalEstimatedPrice
      });
      
      // Emit to the user that we are searching for drivers
      socket.emit('ride_request_received', {
        rideId,
        status: 'searching',
        estimatedPrice: finalEstimatedPrice,
        estimatedDistance: distance,
        currency: 'BDT',
        rideType,
        paymentMethod
      });
      
      // Create notification for user
      createAndSendNotification(io, userId, {
        title: 'Looking for Drivers',
        body: 'We are searching for available drivers in your area...',
        type: 'ride',
        relatedId: rideId,
        data: { 
          status: 'searching',
          estimatedPrice: finalEstimatedPrice,
          currency: 'BDT'
        }
      });
      
      // Find available drivers
      // This would normally have a smart matching algorithm based on:
      // - Proximity to pickup location
      // - Vehicle type matching
      // - Driver ratings
      // - Driver availability
      setTimeout(() => {
        // Get available drivers (filter by proximity, vehicle type, etc.)
        const availableDrivers = Array.from(connectedClients.entries())
          .filter(([driverId, client]) => {
            const hasActiveRide = Array.from(activeRides.values())
              .find(ride => ride.driverId === driverId && 
                    ['driverAccepted', 'driverArrived', 'inProgress'].includes(ride.status));
            
            return client.userType === 'driver' && 
                   client.connected && 
                   client.isOnline &&
                   !hasActiveRide;
          });
        
        if (availableDrivers.length === 0) {
          // No drivers available
          console.log(`No drivers available for ride ${rideId}`);
          
          socket.emit('ride_request_error', { 
            rideId,
            message: 'No drivers available at this time. Please try again later.' 
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
        
        // Mock driver data (in real app, fetch from database)
        const mockDriverData = {
          id: driverId,
          name: `Driver ${driverId.slice(-4)}`,
          phoneNumber: '+8801234567890',
          rating: (4.0 + Math.random()).toFixed(1),
          vehicleInfo: {
            make: ['Toyota', 'Honda', 'Nissan', 'Hyundai'][Math.floor(Math.random() * 4)],
            model: ['Corolla', 'Civic', 'Sunny', 'Elantra'][Math.floor(Math.random() * 4)],
            color: ['White', 'Black', 'Silver', 'Blue'][Math.floor(Math.random() * 4)],
            plateNumber: `DHA-${Math.floor(Math.random() * 9000) + 1000}`
          }
        };
        
        // Update ride with driver info
        ride.driverId = driverId;
        ride.driver = mockDriverData;
        ride.status = 'driverAssigned';
        ride.assignedTime = new Date();
        
        // Store updated ride
        activeRides.set(rideId, ride);
        
        console.log(`Driver ${driverId} assigned to ride ${rideId}`);
        
        // Notify the driver about the ride request
        io.to(`user:${driverId}`).emit('ride_assigned', {
          rideId,
          passengerId: userId,
          pickupLocation,
          dropoffLocation,
          rideType,
          estimatedPrice: ride.estimatedPrice,
          estimatedDistance: ride.estimatedDistance,
          currency: 'BDT',
          paymentMethod,
          passengerName: `User ${userId.slice(-4)}` // In real app, fetch from database
        });
        
        // Create notification for driver
        createAndSendNotification(io, driverId, {
          title: 'New Ride Request',
          body: `New ${rideType} ride from ${pickupLocation.address.substring(0, 30)}...`,
          type: 'ride',
          relatedId: rideId,
          data: { 
            passengerId: userId,
            pickupLocation,
            dropoffLocation,
            estimatedPrice: ride.estimatedPrice,
            rideType
          }
        });
        
        // Notify the user that a driver has been assigned
        io.to(`user:${userId}`).emit('driver_assigned', {
          rideId,
          driver: mockDriverData,
          estimatedArrival: `${Math.floor(Math.random() * 8) + 3} minutes`,
          status: 'driverAssigned'
        });
        
        // Create notification for user
        createAndSendNotification(io, userId, {
          title: 'Driver Found!',
          body: `${mockDriverData.name} is on the way to pick you up.`,
          type: 'ride',
          relatedId: rideId,
          data: { 
            driverId,
            driverName: mockDriverData.name,
            status: 'driverAssigned',
            estimatedArrival: `${Math.floor(Math.random() * 8) + 3} minutes`
          }
        });
        
        // Simulate driver accepting the ride after a short delay
        setTimeout(() => {
          ride.status = 'driverAccepted';
          ride.acceptedTime = new Date();
          activeRides.set(rideId, ride);
          
          // Notify user that driver accepted
          io.to(`user:${userId}`).emit('driver_accepted', {
            rideId,
            driver: mockDriverData,
            status: 'driverAccepted'
          });
          
          console.log(`Driver ${driverId} accepted ride ${rideId}`);
          
          createAndSendNotification(io, userId, {
            title: 'Driver Accepted!',
            body: `${mockDriverData.name} has accepted your ride request and is heading to pickup location.`,
            type: 'ride',
            relatedId: rideId,
            data: { 
              status: 'driverAccepted',
              driverId,
              driverName: mockDriverData.name
            }
          });
        }, 3000); // Driver accepts after 3 seconds
        
      }, 5000); // Simulate 5 second driver search
    });

    // Handle driver accepting ride
    socket.on('driver_accept_ride', async (data) => {
      const { rideId, driverId } = data;
      const ride = activeRides.get(rideId);
      
      if (!ride || ride.driverId !== driverId) {
        socket.emit('ride_action_error', { 
          message: 'Ride not found or you are not assigned to this ride' 
        });
        return;
      }
      
      ride.status = 'driverAccepted';
      ride.acceptedTime = new Date();
      activeRides.set(rideId, ride);
      
      console.log(`Driver ${driverId} manually accepted ride ${rideId}`);
      
      // Notify passenger
      io.to(`user:${ride.userId}`).emit('driver_accepted', {
        rideId,
        driver: ride.driver,
        status: 'driverAccepted'
      });
      
      // Confirm to driver
      socket.emit('ride_action_success', {
        action: 'accepted',
        rideId,
        status: 'driverAccepted'
      });
    });
    
    // Handle driver arrived at pickup
    socket.on('driver_arrived', async (data) => {
      const { rideId, driverId } = data;
      const ride = activeRides.get(rideId);
      
      if (!ride || ride.driverId !== driverId) {
        socket.emit('ride_action_error', { 
          message: 'Ride not found or you are not assigned to this ride' 
        });
        return;
      }
      
      ride.status = 'driverArrived';
      ride.arrivedTime = new Date();
      activeRides.set(rideId, ride);
      
      console.log(`Driver ${driverId} arrived for ride ${rideId}`);
      
      // Notify passenger
      io.to(`user:${ride.userId}`).emit('driver_arrived', {
        rideId,
        driver: ride.driver,
        status: 'driverArrived'
      });
      
      createAndSendNotification(io, ride.userId, {
        title: 'Driver Arrived',
        body: `${ride.driver.name} has arrived at your pickup location.`,
        type: 'ride',
        relatedId: rideId,
        data: { status: 'driverArrived' }
      });
      
      // Confirm to driver
      socket.emit('ride_action_success', {
        action: 'arrived',
        rideId,
        status: 'driverArrived'
      });
    });
    
    // Handle ride start
    socket.on('start_ride', async (data) => {
      const { rideId, driverId } = data;
      const ride = activeRides.get(rideId);
      
      if (!ride || ride.driverId !== driverId) {
        socket.emit('ride_action_error', { 
          message: 'Ride not found or you are not assigned to this ride' 
        });
        return;
      }
      
      ride.status = 'inProgress';
      ride.startTime = new Date();
      activeRides.set(rideId, ride);
      
      console.log(`Ride ${rideId} started by driver ${driverId}`);
      
      // Notify passenger
      io.to(`user:${ride.userId}`).emit('ride_started', {
        rideId,
        driver: ride.driver,
        status: 'inProgress',
        startTime: ride.startTime
      });
      
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Started',
        body: `Your ride to ${ride.dropoffLocation.address.substring(0, 30)}... has started.`,
        type: 'ride',
        relatedId: rideId,
        data: { status: 'inProgress' }
      });
      
      // Confirm to driver
      socket.emit('ride_action_success', {
        action: 'started',
        rideId,
        status: 'inProgress'
      });
    });
    
    // Handle ride completion
    socket.on('complete_ride', async (data) => {
      const { rideId, driverId, actualPrice } = data;
      const ride = activeRides.get(rideId);
      
      if (!ride || ride.driverId !== driverId) {
        socket.emit('ride_action_error', { 
          message: 'Ride not found or you are not assigned to this ride' 
        });
        return;
      }
      
      ride.status = 'completed';
      ride.endTime = new Date();
      ride.actualPrice = actualPrice || ride.estimatedPrice;
      
      // Calculate duration
      const duration = Math.round((ride.endTime - ride.startTime) / 60000); // in minutes
      ride.duration = `${duration} minutes`;
      
      activeRides.set(rideId, ride);
      
      console.log(`Ride ${rideId} completed by driver ${driverId}`);
      
      // Notify passenger
      io.to(`user:${ride.userId}`).emit('ride_completed', {
        rideId,
        driver: ride.driver,
        status: 'completed',
        endTime: ride.endTime,
        actualPrice: ride.actualPrice,
        duration: ride.duration,
        distance: `${ride.estimatedDistance.toFixed(1)} km`
      });
      
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Completed',
        body: `Your ride has been completed successfully. Total: ৳${ride.actualPrice}`,
        type: 'ride',
        relatedId: rideId,
        data: { 
          status: 'completed',
          actualPrice: ride.actualPrice
        }
      });
      
      // Confirm to driver
      socket.emit('ride_action_success', {
        action: 'completed',
        rideId,
        status: 'completed',
        earnings: ride.actualPrice
      });
      
      // Clean up after some time
      setTimeout(() => {
        activeRides.delete(rideId);
        console.log(`Cleaned up completed ride ${rideId}`);
      }, 300000); // Clean up after 5 minutes
    });
    
    // Handle ride cancellation
    socket.on('cancel_ride', async (data) => {
      const { rideId, userId, reason } = data;
      const ride = activeRides.get(rideId);
      
      if (!ride) {
        socket.emit('ride_action_error', { 
          message: 'Ride not found' 
        });
        return;
      }
      
      // Check if user has permission to cancel
      if (ride.userId !== userId && ride.driverId !== userId) {
        socket.emit('ride_action_error', { 
          message: 'You do not have permission to cancel this ride' 
        });
        return;
      }
      
      ride.status = 'cancelled';
      ride.cancelledTime = new Date();
      ride.cancelledBy = ride.userId === userId ? 'passenger' : 'driver';
      ride.cancellationReason = reason || 'No reason provided';
      
      activeRides.set(rideId, ride);
      
      console.log(`Ride ${rideId} cancelled by ${ride.cancelledBy}: ${reason}`);
      
      // Notify both parties
      if (ride.userId !== userId) {
        io.to(`user:${ride.userId}`).emit('ride_cancelled', {
          rideId,
          status: 'cancelled',
          cancelledBy: ride.cancelledBy,
          reason: ride.cancellationReason
        });
        
        createAndSendNotification(io, ride.userId, {
          title: 'Ride Cancelled',
          body: `Your ride has been cancelled by the ${ride.cancelledBy}.`,
          type: 'ride',
          relatedId: rideId,
          data: { status: 'cancelled' }
        });
      }
      
      if (ride.driverId && ride.driverId !== userId) {
        io.to(`user:${ride.driverId}`).emit('ride_cancelled', {
          rideId,
          status: 'cancelled',
          cancelledBy: ride.cancelledBy,
          reason: ride.cancellationReason
        });
        
        createAndSendNotification(io, ride.driverId, {
          title: 'Ride Cancelled',
          body: `The ride has been cancelled by the ${ride.cancelledBy}.`,
          type: 'ride',
          relatedId: rideId,
          data: { status: 'cancelled' }
        });
      }
      
      // Confirm to canceller
      socket.emit('ride_action_success', {
        action: 'cancelled',
        rideId,
        status: 'cancelled'
      });
      
      // Clean up cancelled ride
      setTimeout(() => {
        activeRides.delete(rideId);
        console.log(`Cleaned up cancelled ride ${rideId}`);
      }, 60000); // Clean up after 1 minute
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
      
      // Initialize driver movement history for this ride if not exists
      if (!driverMovementHistory.has(driverId)) {
        driverMovementHistory.set(driverId, []);
      }
      
      // If we have the driver's current location, add it as the first point
      if (driverLocations.has(driverId)) {
        const location = driverLocations.get(driverId).location;
        updateDriverMovement(io, driverId, location, ride);
      }
      
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
      
      // Clear the route history up to this point - we'll start tracking from pickup
      if (ride.route && ride.route.length > 0) {
        // Keep the last position as starting point
        const lastPosition = ride.route[ride.route.length - 1];
        ride.route = [lastPosition];
        activeRides.set(rideId, ride);
      }
      
      // Reset the actual distance - only count from pickup to dropoff
      ride.actualDistance = 0;
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('driver_arrived', {
        rideId,
        driverId,
        message: 'Your driver has arrived at the pickup location.',
        arrivalTime: ride.arrivalTime
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Driver Arrived',
        body: 'Your driver has arrived at the pickup location.',
        type: 'ride',
        relatedId: rideId,
        data: { driverId, status: 'arrived', arrivalTime: ride.arrivalTime }
      });
    });
    
    // Handle ride started
    socket.on('ride_started', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'inProgress';
      ride.startTime = new Date();
      
      // Reset actual distance since we're starting from pickup now
      ride.actualDistance = 0;
      
      // Reset the route to track only from the pickup point
      if (driverLocations.has(driverId)) {
        const currentLocation = driverLocations.get(driverId).location;
        ride.route = [{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          timestamp: new Date()
        }];
      } else {
        ride.route = [];
      }
      
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
    socket.on('ride_completed', ({ driverId, rideId }) => {
      const ride = activeRides.get(rideId);
      if (!ride) return;
      
      ride.status = 'completed';
      ride.endTime = new Date();
      
      // Calculate final fare based on actual distance traveled
      // If no actual distance was recorded (unlikely), use the estimated distance
      const distance = ride.actualDistance || ride.estimatedDistance;
      const finalFare = calculateFare(distance);
      
      ride.finalFare = finalFare;
      ride.actualDistance = distance;
      
      // Calculate ride duration in minutes
      if (ride.startTime) {
        ride.actualDuration = Math.round((ride.endTime.getTime() - ride.startTime.getTime()) / (1000 * 60));
      }
      
      activeRides.set(rideId, ride);
      
      // Send to the user
      io.to(`user:${ride.userId}`).emit('ride_completed', {
        rideId,
        driverId,
        message: 'Your ride has been completed.',
        endTime: ride.endTime,
        finalFare: ride.finalFare,
        actualDistance: ride.actualDistance,
        actualDuration: ride.actualDuration,
        currency: 'BDT'
      });
      
      // Create notification for user
      createAndSendNotification(io, ride.userId, {
        title: 'Ride Completed',
        body: `Your ride has been completed. Final fare: ${ride.finalFare.toFixed(2)} BDT`,
        type: 'ride',
        relatedId: rideId,
        data: { 
          driverId, 
          status: 'completed',
          endTime: ride.endTime,
          finalFare: ride.finalFare,
          actualDistance: ride.actualDistance,
          currency: 'BDT'
        }
      });
      
      // Send receipt to driver too
      io.to(`user:${driverId}`).emit('ride_completed_driver', {
        rideId,
        userId: ride.userId,
        finalFare: ride.finalFare,
        actualDistance: ride.actualDistance,
        actualDuration: ride.actualDuration,
        currency: 'BDT'
      });
      
      // After completion, move the ride from active to history
      setTimeout(() => {
        // In a production app, this would be persisted to a database
        activeRides.delete(rideId);
        // Also clean up the driver movement history
        if (driverMovementHistory.has(driverId)) {
          driverMovementHistory.delete(driverId);
        }
      }, 1000 * 60 * 10); // Keep in memory for 10 minutes before removing
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
        // Also clean up any driver movement history
        if (ride.driverId && driverMovementHistory.has(ride.driverId)) {
          driverMovementHistory.delete(ride.driverId);
        }
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