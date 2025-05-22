const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  }
});

const rideSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pickupLocation: {
    type: locationSchema,
    required: true
  },
  dropoffLocation: {
    type: locationSchema,
    required: true
  },
  rideType: {
    type: String,
    enum: ['standard', 'premium', 'shared', 'xl'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: [
      'searching',         // Looking for drivers
      'driverAssigned',    // Driver assigned but not accepted
      'driverAccepted',    // Driver accepted the ride
      'driverArrived',     // Driver arrived at pickup location
      'inProgress',        // Ride in progress
      'completed',         // Ride completed
      'cancelled',         // Ride cancelled by user or driver
      'noDriverFound'      // No driver found
    ],
    default: 'searching'
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'driver', 'system', null],
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  requestTime: {
    type: Date,
    default: Date.now
  },
  assignedTime: {
    type: Date
  },
  arrivalTime: {
    type: Date
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  scheduledTime: {
    type: Date
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  estimatedDistance: {
    type: Number, // in kilometers
  },
  estimatedDuration: {
    type: Number, // in minutes
  },
  actualDistance: {
    type: Number, // in kilometers
  },
  actualDuration: {
    type: Number, // in minutes
  },
  estimatedPrice: {
    type: Number,
    required: true
  },
  finalPrice: {
    type: Number
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'cash', 'wallet', 'paypal'],
    default: 'credit_card'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  route: [{
    latitude: Number,
    longitude: Number,
    timestamp: Date
  }],
  promoCode: {
    type: String,
    trim: true
  },
  rating: {
    user: {
      value: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: {
        type: String,
        trim: true
      },
      timestamp: {
        type: Date
      }
    },
    driver: {
      value: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: {
        type: String,
        trim: true
      },
      timestamp: {
        type: Date
      }
    }
  }
}, {
  timestamps: true
});

// Create index for faster queries
rideSchema.index({ user: 1, status: 1 });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ requestTime: -1 });

// Create a compound index for scheduled rides
rideSchema.index({ isScheduled: 1, scheduledTime: 1, status: 1 });

// Virtual for calculating ride duration
rideSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return (this.endTime - this.startTime) / (1000 * 60); // in minutes
  }
  return null;
});

// Method to calculate price after the ride
rideSchema.methods.calculateFinalPrice = function() {
  // Base price is the estimated price
  let price = this.estimatedPrice;
  
  // If actual distance or duration is available, recalculate
  if (this.actualDistance && this.estimatedDistance) {
    // Adjust price based on actual vs estimated distance
    const distanceRatio = this.actualDistance / this.estimatedDistance;
    price = price * distanceRatio;
  }
  
  // Apply surge pricing, if any (would be determined by external factors)
  
  // Apply promo code discount if any
  // This would typically query a promos collection
  
  return parseFloat(price.toFixed(2));
};

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride; 