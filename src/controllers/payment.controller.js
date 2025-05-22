const Ride = require('../models/ride.model');
const { validationResult } = require('express-validator');

/**
 * Process a payment
 * @route POST /api/payments/process
 * @access Private
 */
const processPayment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { rideId, paymentMethodId } = req.body;
    const user = req.user;

    // Find the ride
    const ride = await Ride.findById(rideId)
      .populate('driver', 'name');

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to pay for this ride
    if (ride.user.toString() !== user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to pay for this ride' 
      });
    }

    // Check if the ride is completed
    if (ride.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Cannot process payment for incomplete ride' 
      });
    }

    // Check if the ride has already been paid
    if (ride.paymentStatus === 'completed') {
      return res.status(400).json({ 
        message: 'Payment has already been processed for this ride' 
      });
    }

    // In a real app, you would process the payment here using a payment gateway
    // This would involve sending the paymentMethodId, amount, and other details
    // to the payment processor's API

    // For demonstration, we'll just mark the payment as completed
    ride.paymentStatus = 'completed';
    await ride.save();

    res.status(200).json({
      message: 'Payment processed successfully',
      ride
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ 
      message: 'Failed to process payment' 
    });
  }
};

/**
 * Get payment history
 * @route GET /api/payments/history
 * @access Private
 */
const getPaymentHistory = async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get completed rides with payment status
    const query = { 
      user: req.user._id,
      status: 'completed'
    };

    // Get total count
    const total = await Ride.countDocuments(query);

    // Get rides
    const rides = await Ride.find(query)
      .sort({ endTime: -1 })
      .skip(skip)
      .limit(limit)
      .populate('driver', 'name');

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Transform rides to payment history
    const paymentHistory = rides.map(ride => ({
      id: ride._id,
      date: ride.endTime,
      amount: ride.finalPrice || ride.estimatedPrice,
      driver: ride.driver ? ride.driver.name : 'Unknown Driver',
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      pickup: ride.pickupLocation.address,
      dropoff: ride.dropoffLocation.address,
      rideId: ride._id
    }));

    res.status(200).json({
      paymentHistory,
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
    console.error('Get payment history error:', error);
    res.status(500).json({ 
      message: 'Failed to get payment history' 
    });
  }
};

/**
 * Get receipt for a ride
 * @route GET /api/payments/receipt/:rideId
 * @access Private
 */
const getReceipt = async (req, res) => {
  try {
    const { rideId } = req.params;
    const user = req.user;

    // Find the ride
    const ride = await Ride.findById(rideId)
      .populate('driver', 'name')
      .populate('user', 'name email');

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to view this receipt
    if (ride.user._id.toString() !== user._id.toString() && 
        (!ride.driver || ride.driver._id.toString() !== user._id.toString())) {
      return res.status(403).json({ 
        message: 'Not authorized to view this receipt' 
      });
    }

    // Check if the ride is completed
    if (ride.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Receipt is only available for completed rides' 
      });
    }

    // Calculate ride duration in minutes
    let duration = 0;
    if (ride.startTime && ride.endTime) {
      duration = Math.round((ride.endTime - ride.startTime) / (1000 * 60));
    }

    // Create receipt
    const receipt = {
      receiptId: `REC-${ride._id.toString().substring(0, 8)}`,
      rideId: ride._id,
      date: ride.endTime || ride.requestTime,
      passenger: ride.user.name,
      passengerEmail: ride.user.email,
      driver: ride.driver ? ride.driver.name : 'Unknown Driver',
      pickup: ride.pickupLocation.address,
      dropoff: ride.dropoffLocation.address,
      distance: ride.actualDistance || ride.estimatedDistance,
      duration: ride.actualDuration || ride.estimatedDuration || duration,
      rideType: ride.rideType,
      subtotal: ride.estimatedPrice,
      discount: 0, // In a real app, calculate discount if there was a promo code
      total: ride.finalPrice || ride.estimatedPrice,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      currency: 'USD'
    };

    res.status(200).json({
      receipt
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ 
      message: 'Failed to get receipt' 
    });
  }
};

/**
 * Add a tip to a completed ride
 * @route POST /api/payments/tip
 * @access Private
 */
const addTip = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { rideId, tipAmount } = req.body;
    const user = req.user;

    // Validate tip amount
    if (tipAmount <= 0) {
      return res.status(400).json({ 
        message: 'Tip amount must be greater than zero' 
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ 
        message: 'Ride not found' 
      });
    }

    // Verify that this user is authorized to add a tip
    if (ride.user.toString() !== user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to add a tip to this ride' 
      });
    }

    // Check if the ride is completed
    if (ride.status !== 'completed') {
      return res.status(400).json({ 
        message: 'Can only add a tip to completed rides' 
      });
    }

    // In a real app, you would process the tip payment here
    // using a payment gateway

    // Update the ride with the tip
    const finalPrice = (ride.finalPrice || ride.estimatedPrice) + tipAmount;
    ride.finalPrice = finalPrice;
    
    await ride.save();

    res.status(200).json({
      message: 'Tip added successfully',
      ride
    });
  } catch (error) {
    console.error('Add tip error:', error);
    res.status(500).json({ 
      message: 'Failed to add tip' 
    });
  }
};

module.exports = {
  processPayment,
  getPaymentHistory,
  getReceipt,
  addTip
}; 