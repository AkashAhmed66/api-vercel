const User = require('../models/user.model');
const Ride = require('../models/ride.model');
const { validationResult } = require('express-validator');

/**
 * Update driver availability
 * @route PUT /api/drivers/availability
 * @access Private (Driver)
 */
const updateAvailability = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { isActive } = req.body;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can update availability' 
      });
    }

    // Update driver availability
    driver.driverInfo.isActive = !!isActive;
    driver.driverInfo.currentLocation.lastUpdated = new Date();
    
    await driver.save();

    res.status(200).json({
      message: isActive ? 'You are now available for rides' : 'You are now offline',
      driverInfo: driver.driverInfo
    });
  } catch (error) {
    console.error('Update driver availability error:', error);
    res.status(500).json({ 
      message: 'Failed to update availability' 
    });
  }
};

/**
 * Update driver location
 * @route PUT /api/drivers/location
 * @access Private (Driver)
 */
const updateLocation = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { latitude, longitude } = req.body;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can update location' 
      });
    }

    // Update driver location
    driver.driverInfo.currentLocation = {
      latitude,
      longitude,
      lastUpdated: new Date()
    };
    
    await driver.save();

    // Get socket.io instance from req.app to broadcast location update
    const io = req.app.io;
    if (io) {
      // Find any active rides for this driver
      const activeRide = await Ride.findOne({
        driver: driver._id,
        status: { $in: ['driverAccepted', 'driverArrived', 'inProgress'] }
      });

      if (activeRide) {
        // Emit location update to the rider
        io.to(`user:${activeRide.user.toString()}`).emit('driver_location_update', {
          rideId: activeRide._id.toString(),
          driverId: driver._id.toString(),
          location: {
            latitude,
            longitude
          },
          lastUpdated: new Date()
        });

        // Add this location to ride route if ride is in progress
        if (activeRide.status === 'inProgress') {
          // Update route array in the ride document
          await Ride.findByIdAndUpdate(activeRide._id, {
            $push: {
              route: {
                latitude,
                longitude,
                timestamp: new Date()
              }
            }
          });
        }
      }

      // Also emit to all admins if needed
      io.to('admin').emit('driver_location_update', {
        driverId: driver._id.toString(),
        location: {
          latitude,
          longitude
        },
        lastUpdated: new Date()
      });
    }

    res.status(200).json({
      message: 'Location updated successfully',
      location: driver.driverInfo.currentLocation
    });
  } catch (error) {
    console.error('Update driver location error:', error);
    res.status(500).json({ 
      message: 'Failed to update location' 
    });
  }
};

/**
 * Accept a ride request
 * @route PUT /api/drivers/rides/:rideId/accept
 * @access Private (Driver)
 */
const acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can accept rides' 
      });
    }

    // Make sure driver is active
    if (!driver.driverInfo.isActive) {
      return res.status(400).json({ 
        message: 'You must be active to accept rides' 
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Check if the ride is available to accept
    if (ride.status !== 'searching' && ride.status !== 'driverAssigned') {
      return res.status(400).json({ 
        message: `Cannot accept a ride with status "${ride.status}"` 
      });
    }

    // Check if ride is already assigned to a different driver
    if (ride.driver && ride.driver.toString() !== driver._id.toString()) {
      return res.status(400).json({ 
        message: 'This ride is already assigned to another driver' 
      });
    }

    // Update ride
    ride.driver = driver._id;
    ride.status = 'driverAccepted';
    ride.assignedTime = new Date();
    
    await ride.save();

    res.status(200).json({
      message: 'Ride accepted successfully',
      ride
    });

    // Note: In a real app, you would trigger a socket event here
    // to notify the user that their ride has been accepted
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ 
      message: 'Failed to accept ride' 
    });
  }
};

/**
 * Arrive at pickup location
 * @route PUT /api/drivers/rides/:rideId/arrive
 * @access Private (Driver)
 */
const arriveAtPickup = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can update ride status' 
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Check if this driver is assigned to this ride
    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ 
        message: 'You are not assigned to this ride' 
      });
    }

    // Check if the ride status is valid
    if (ride.status !== 'driverAccepted') {
      return res.status(400).json({ 
        message: `Cannot arrive for a ride with status "${ride.status}"` 
      });
    }

    // Update ride
    ride.status = 'driverArrived';
    ride.arrivalTime = new Date();
    
    await ride.save();

    res.status(200).json({
      message: 'Arrival confirmed successfully',
      ride
    });

    // Note: In a real app, you would trigger a socket event here
    // to notify the user that their driver has arrived
  } catch (error) {
    console.error('Arrive at pickup error:', error);
    res.status(500).json({ 
      message: 'Failed to confirm arrival' 
    });
  }
};

/**
 * Start a ride
 * @route PUT /api/drivers/rides/:rideId/start
 * @access Private (Driver)
 */
const startRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can update ride status' 
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Check if this driver is assigned to this ride
    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ 
        message: 'You are not assigned to this ride' 
      });
    }

    // Check if the ride status is valid
    if (ride.status !== 'driverArrived') {
      return res.status(400).json({ 
        message: `Cannot start a ride with status "${ride.status}"` 
      });
    }

    // Update ride
    ride.status = 'inProgress';
    ride.startTime = new Date();
    
    // Reset route to track from pickup to dropoff
    ride.route = [{
      latitude: driver.driverInfo.currentLocation.latitude, 
      longitude: driver.driverInfo.currentLocation.longitude,
      timestamp: new Date()
    }];
    
    // Reset actual distance since we're now starting from pickup
    ride.actualDistance = 0;
    
    await ride.save();

    res.status(200).json({
      message: 'Ride started successfully',
      ride
    });
    
    // Get socket.io instance to notify rider
    const io = req.app.io;
    if (io) {
      // Emit to rider that ride has started
      io.to(`user:${ride.user.toString()}`).emit('ride_started', {
        rideId: ride._id.toString(),
        driverId: driver._id.toString(),
        message: 'Your ride has started.',
        startTime: ride.startTime,
        pickupLocation: ride.pickupLocation,
        dropoffLocation: ride.dropoffLocation,
        estimatedPrice: ride.estimatedPrice
      });
    }
  } catch (error) {
    console.error('Start ride error:', error);
    res.status(500).json({ 
      message: 'Failed to start ride' 
    });
  }
};

/**
 * Complete a ride
 * @route PUT /api/drivers/rides/:rideId/complete
 * @access Private (Driver)
 */
const completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { actualDistance, actualDuration } = req.body;
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can update ride status' 
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Check if this driver is assigned to this ride
    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ 
        message: 'You are not assigned to this ride' 
      });
    }

    // Check if the ride status is valid
    if (ride.status !== 'inProgress') {
      return res.status(400).json({ 
        message: `Cannot complete a ride with status "${ride.status}"` 
      });
    }

    // Update ride
    ride.status = 'completed';
    ride.endTime = new Date();
    
    // Calculate ride duration if not provided
    if (!actualDuration && ride.startTime) {
      const durationMs = ride.endTime.getTime() - ride.startTime.getTime();
      ride.actualDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
    } else if (actualDuration) {
      ride.actualDuration = actualDuration;
    }
    
    // Use provided distance or what we've been tracking
    if (actualDistance) {
      ride.actualDistance = actualDistance;
    }
    
    // Always ensure we have an actual distance
    if (!ride.actualDistance || ride.actualDistance <= 0) {
      // Fall back to estimated distance if no actual distance recorded
      ride.actualDistance = ride.estimatedDistance;
    }
    
    // Calculate final price - 20 taka per km
    const FARE_PER_KM = 20;
    ride.finalPrice = Math.round(ride.actualDistance * FARE_PER_KM);
    
    // Apply minimum fare if needed (e.g. 50 taka)
    const MIN_FARE = 50;
    if (ride.finalPrice < MIN_FARE) {
      ride.finalPrice = MIN_FARE;
    }
    
    // Update payment status (assuming cash payment by default)
    ride.paymentStatus = 'completed';
    
    await ride.save();

    // Prepare response data
    const rideData = {
      id: ride._id.toString(),
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      actualDistance: ride.actualDistance,
      actualDuration: ride.actualDuration,
      finalPrice: ride.finalPrice,
      startTime: ride.startTime,
      endTime: ride.endTime,
      currency: 'BDT',
      paymentStatus: ride.paymentStatus
    };

    // Notify rider via Socket.IO
    const io = req.app.io;
    if (io) {
      io.to(`user:${ride.user.toString()}`).emit('ride_completed', {
        rideId: ride._id.toString(),
        driverId: driver._id.toString(),
        message: 'Your ride has been completed.',
        endTime: ride.endTime,
        finalFare: ride.finalPrice,
        actualDistance: ride.actualDistance,
        actualDuration: ride.actualDuration,
        currency: 'BDT',
        paymentStatus: ride.paymentStatus
      });
    }

    res.status(200).json({
      message: 'Ride completed successfully',
      ride: rideData
    });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ 
      message: 'Failed to complete ride' 
    });
  }
};

/**
 * Get driver's ride history
 * @route GET /api/drivers/rides
 * @access Private (Driver)
 */
const getDriverRides = async (req, res) => {
  try {
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can access this endpoint' 
      });
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get status filter
    const status = req.query.status;
    
    // Build query
    const query = { driver: driver._id };
    if (status) {
      query.status = status;
    }

    // Get total count
    const total = await Ride.countDocuments(query);

    // Get rides
    const rides = await Ride.find(query)
      .sort({ requestTime: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name profilePic');

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      rides,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get driver rides error:', error);
    res.status(500).json({ 
      message: 'Failed to get rides' 
    });
  }
};

/**
 * Get driver's current ride
 * @route GET /api/drivers/rides/current
 * @access Private (Driver)
 */
const getCurrentRide = async (req, res) => {
  try {
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can access this endpoint' 
      });
    }

    // Find in-progress ride for this driver
    const ride = await Ride.findOne({
      driver: driver._id,
      status: { $in: ['driverAccepted', 'driverArrived', 'inProgress'] }
    }).populate('user', 'name phone profilePic rating');

    if (!ride) {
      return res.status(404).json({ 
        message: 'No active ride found' 
      });
    }

    res.status(200).json({
      ride
    });
  } catch (error) {
    console.error('Get current ride error:', error);
    res.status(500).json({ 
      message: 'Failed to get current ride' 
    });
  }
};

/**
 * Get driver's stats
 * @route GET /api/drivers/stats
 * @access Private (Driver)
 */
const getDriverStats = async (req, res) => {
  try {
    const driver = req.user;

    // Make sure this is a driver
    if (driver.role !== 'driver') {
      return res.status(403).json({ 
        message: 'Only drivers can access this endpoint' 
      });
    }

    // Get total completed rides
    const totalRides = await Ride.countDocuments({
      driver: driver._id,
      status: 'completed'
    });

    // Get total earnings
    const earningsResult = await Ride.aggregate([
      {
        $match: {
          driver: driver._id,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$finalPrice' }
        }
      }
    ]);

    const totalEarnings = earningsResult.length > 0 ? earningsResult[0].totalEarnings : 0;

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRides = await Ride.countDocuments({
      driver: driver._id,
      status: 'completed',
      endTime: { $gte: today }
    });

    const todayEarningsResult = await Ride.aggregate([
      {
        $match: {
          driver: driver._id,
          status: 'completed',
          endTime: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$finalPrice' }
        }
      }
    ]);

    const todayEarnings = todayEarningsResult.length > 0 ? todayEarningsResult[0].totalEarnings : 0;

    res.status(200).json({
      stats: {
        rating: driver.rating.average,
        ratingCount: driver.rating.count,
        totalRides,
        totalEarnings,
        todayRides,
        todayEarnings,
        isActive: driver.driverInfo.isActive
      }
    });
  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({ 
      message: 'Failed to get stats' 
    });
  }
};

module.exports = {
  updateAvailability,
  updateLocation,
  acceptRide,
  arriveAtPickup,
  startRide,
  completeRide,
  getDriverRides,
  getCurrentRide,
  getDriverStats
}; 