const mongoose = require('mongoose');

const rideOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  basePrice: {
    type: Number,
    required: true
  },
  pricePerKm: {
    type: Number,
    required: true
  },
  pricePerMinute: {
    type: Number,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  surgeMultiplier: {
    type: Number,
    default: 1.0
  },
  waitingChargePerMinute: {
    type: Number,
    default: 0
  },
  cancellationFee: {
    type: Number,
    default: 0
  },
  minimumFare: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Method to calculate price
rideOptionSchema.methods.calculateEstimatedPrice = function(distance, duration) {
  // Base price + (price per km * distance) + (price per minute * duration)
  let price = this.basePrice + (this.pricePerKm * distance) + (this.pricePerMinute * duration);
  
  // Apply surge multiplier if applicable
  price = price * this.surgeMultiplier;
  
  // Ensure minimum fare
  price = Math.max(price, this.minimumFare);
  
  // Round to 2 decimal places
  return parseFloat(price.toFixed(2));
};

const RideOption = mongoose.model('RideOption', rideOptionSchema);

module.exports = RideOption; 