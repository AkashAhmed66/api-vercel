const Ride = require('../models/ride.model');
const RideOption = require('../models/rideOption.model');
const User = require('../models/user.model');
const { validationResult } = require('express-validator');

/**
 * Get available ride options
 * @route GET /api/rides/options
 * @access Private
 */
const getRideOptions = async (req, res) => {
  try {
    // Get all active ride options
    const rideOptions = await RideOption.find({ isActive: true }).sort('order');

    res.status(200).json({
      rideOptions
    });
  } catch (error) {
    console.error('Get ride options error:', error);
    res.status(500).json({ 
      message: 'Failed to get ride options' 
    });
  }
};

/**
 * Estimate ride price
 * @route POST /api/rides/estimate
 * @access Private
 */
const estimateRide = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { 
      pickupLocation, 
      dropoffLocation, 
      rideType = 'standard',
      distance,      // in kilometers
      duration       // in minutes
    } = req.body;

    if (!pickupLocation || !dropoffLocation || !distance || !duration) {
      return res.status(400).json({ 
        message: 'Missing required parameters' 
      });
    }

    // Calculate price based on fixed rate (20 taka per km)
    const FARE_PER_KM = 20;
    let estimatedPrice = Math.round(distance * FARE_PER_KM);
    
    // Get ride option for potential modifiers
    const rideOption = await RideOption.findOne({ 
      name: rideType.toLowerCase(),
      isActive: true
    });

    if (rideOption) {
      // Apply any multipliers from the ride option
      if (rideOption.priceMultiplier && rideOption.priceMultiplier > 1) {
        estimatedPrice = Math.round(estimatedPrice * rideOption.priceMultiplier);
      }
      
      // Apply minimum fare if needed
      if (rideOption.minimumFare && estimatedPrice < rideOption.minimumFare) {
        estimatedPrice = rideOption.minimumFare;
      }
    }

    res.status(200).json({
      estimatedPrice,
      distance,
      duration,
      currency: 'BDT', // Bangladeshi Taka
      farePerKm: FARE_PER_KM,
      rideDetails: {
        type: rideType,
        ...(rideOption ? { options: rideOption } : {})
      }
    });
  } catch (error) {
    console.error('Estimate ride error:', error);
    res.status(500).json({ 
      message: 'Failed to estimate ride' 
    });
  }
};

/**
 * Request a ride
 * @route POST /api/rides/request
 * @access Private
 */
const requestRide = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { 
      pickupLocation, 
      dropoffLocation, 
      rideType = 'standard',
      estimatedDistance,
      estimatedDuration,
      estimatedPrice,
      paymentMethod,
      scheduledTime,
      isScheduled,
      isRecurring,
      recurringDays,
      promoCode
    } = req.body;

    if (!pickupLocation || !dropoffLocation) {
      return res.status(400).json({ 
        message: 'Missing required parameters' 
      });
    }
    
    // Calculate distance if not provided
    let distance = estimatedDistance;
    if (!distance) {
      // Calculate distance between pickup and dropoff using the Haversine formula
      const R = 6371; // Radius of the Earth in km
      const dLat = deg2rad(dropoffLocation.latitude - pickupLocation.latitude);
      const dLon = deg2rad(dropoffLocation.longitude - pickupLocation.longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(pickupLocation.latitude)) * Math.cos(deg2rad(dropoffLocation.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance = R * c; // Distance in km
    }
    
    // Calculate fare based on 20 taka per km
    const FARE_PER_KM = 20;
    const calculatedFare = Math.round(distance * FARE_PER_KM);
    
    // Use the provided estimated price or our calculation
    const finalEstimatedPrice = estimatedPrice || calculatedFare;

    // Create new ride request
    const ride = new Ride({
      user: req.user._id,
      pickupLocation,
      dropoffLocation,
      rideType,
      estimatedDistance: distance,
      estimatedDuration: estimatedDuration || Math.round(distance * 2), // Rough estimate: 30 km/h = 2 min/km
      estimatedPrice: finalEstimatedPrice,
      farePerKm: FARE_PER_KM,
      paymentMethod: paymentMethod || 'cash',
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      isScheduled: !!isScheduled,
      isRecurring: !!isRecurring,
      recurringDays: recurringDays || [],
      promoCode,
      status: isScheduled ? 'scheduled' : 'searching',
      requestTime: new Date(),
      currency: 'BDT' // Bangladesh Taka
    });

    // Save ride to database
    await ride.save();

    // If this is a scheduled ride, we don't need to search for drivers now
    if (isScheduled) {
      return res.status(201).json({
        message: 'Ride scheduled successfully',
        ride
      });
    }

    // Get socket.io instance from req.app
    const io = req.app.io;
    
    if (io) {
      // Emit ride request event to find drivers
      const rideData = {
        id: ride._id.toString(),
        userId: req.user._id.toString(),
        pickupLocation,
        dropoffLocation,
        rideType,
        estimatedPrice: finalEstimatedPrice,
        estimatedDistance: distance,
        paymentMethod: ride.paymentMethod,
        user: {
          name: req.user.name,
          phone: req.user.phone
        }
      };
      
      // This emits to all connected drivers
      io.to('drivers').emit('new_ride_request', rideData);
      
      // Also emit to specific user as confirmation
      io.to(`user:${req.user._id}`).emit('ride_request_received', {
        rideId: ride._id.toString(),
        status: 'searching',
        estimatedPrice: finalEstimatedPrice,
        estimatedDistance: distance,
        currency: 'BDT'
      });
    }

    res.status(201).json({
      message: 'Ride requested successfully',
      ride
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ 
      message: 'Failed to request ride',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function for distance calculation
const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

/**
 * Cancel a ride
 * @route PUT /api/rides/:rideId/cancel
 * @access Private
 */
const cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to cancel this ride
    if (ride.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to cancel this ride' 
      });
    }

    // Check if the ride can be cancelled
    const cancelableStatuses = ['searching', 'driverAssigned', 'driverAccepted', 'scheduled'];
    if (!cancelableStatuses.includes(ride.status)) {
      return res.status(400).json({ 
        message: `Cannot cancel a ride with status "${ride.status}"` 
      });
    }

    // Update ride
    ride.status = 'cancelled';
    ride.cancelledBy = 'user';
    ride.cancellationReason = reason || 'User cancelled';

    // Save ride
    await ride.save();

    res.status(200).json({
      message: 'Ride cancelled successfully',
      ride
    });

    // Note: In a real app, you would trigger a socket event here
    // to notify the driver (if assigned) about the cancellation
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ 
      message: 'Failed to cancel ride' 
    });
  }
};

/**
 * Get user's ride history
 * @route GET /api/rides/history
 * @access Private
 */
const getRideHistory = async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get status filter
    const status = req.query.status;
    
    // Build query
    const query = { user: req.user._id };
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
      .populate('driver', 'name profilePic rating');

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
    console.error('Get ride history error:', error);
    res.status(500).json({ 
      message: 'Failed to get ride history' 
    });
  }
};

/**
 * Get scheduled rides
 * @route GET /api/rides/scheduled
 * @access Private
 */
const getScheduledRides = async (req, res) => {
  try {
    // Find all scheduled rides for the user that are not completed or cancelled
    const rides = await Ride.find({
      user: req.user._id,
      isScheduled: true,
      status: { $nin: ['completed', 'cancelled'] }
    }).sort({ scheduledTime: 1 });

    res.status(200).json({
      rides
    });
  } catch (error) {
    console.error('Get scheduled rides error:', error);
    res.status(500).json({ 
      message: 'Failed to get scheduled rides' 
    });
  }
};

/**
 * Get ride by ID
 * @route GET /api/rides/:rideId
 * @access Private
 */
const getRideById = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Find the ride
    const ride = await Ride.findById(rideId)
      .populate('driver', 'name profilePic phone rating driverInfo');

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to view this ride
    if (ride.user.toString() !== req.user._id.toString() && 
        (!ride.driver || ride.driver._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ 
        message: 'Not authorized to view this ride' 
      });
    }

    res.status(200).json({
      ride
    });
  } catch (error) {
    console.error('Get ride by ID error:', error);
    res.status(500).json({ 
      message: 'Failed to get ride' 
    });
  }
};

/**
 * Rate a completed ride
 * @route POST /api/rides/:rideId/rate
 * @access Private
 */
const rateRide = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { rideId } = req.params;
    const { rating, comment } = req.body;

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to rate this ride
    if (ride.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to rate this ride' 
      });
    }

    // Check if the ride is completed
    if (ride.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Can only rate completed rides' 
      });
    }

    // Check if the ride has already been rated
    if (ride.rating && ride.rating.user && ride.rating.user.value) {
      return res.status(400).json({ 
        message: 'Ride has already been rated' 
      });
    }

    // Update ride with rating
    ride.rating = {
      ...ride.rating,
      user: {
        value: rating,
        comment,
        timestamp: new Date()
      }
    };

    // Save ride
    await ride.save();

    // Update driver's average rating
    if (ride.driver) {
      const driver = await User.findById(ride.driver);
      if (driver) {
        // Calculate new average rating
        const newCount = driver.rating.count + 1;
        const newAvg = ((driver.rating.average * driver.rating.count) + rating) / newCount;
        
        // Update driver
        driver.rating.average = parseFloat(newAvg.toFixed(1));
        driver.rating.count = newCount;
        
        await driver.save();
      }
    }

    res.status(200).json({
      message: 'Ride rated successfully',
      ride
    });
  } catch (error) {
    console.error('Rate ride error:', error);
    res.status(500).json({ 
      message: 'Failed to rate ride' 
    });
  }
};

module.exports = {
  getRideOptions,
  estimateRide,
  requestRide,
  cancelRide,
  getRideHistory,
  getScheduledRides,
  getRideById,
  rateRide
}; 