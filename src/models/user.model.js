const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schema for saved locations
const savedPlaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
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
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Schema for payment methods
const paymentMethodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_account', 'paypal', 'cash'],
    required: true
  },
  cardNumber: {
    type: String,
    trim: true
  },
  cardHolderName: {
    type: String,
    trim: true
  },
  expiryMonth: {
    type: Number
  },
  expiryYear: {
    type: Number
  },
  last4: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Main user schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  profilePic: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'driver', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  homeAddress: {
    type: savedPlaceSchema,
    default: null
  },
  workAddress: {
    type: savedPlaceSchema,
    default: null
  },
  savedPlaces: [savedPlaceSchema],
  paymentMethods: [paymentMethodSchema],
  preferredPaymentMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod'
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  driverInfo: {
    licenseNumber: {
      type: String,
      trim: true
    },
    licenseExpiryDate: {
      type: Date
    },
    vehicleDetails: {
      type: {
        type: String,
        enum: ['sedan', 'suv', 'luxury', 'eco'],
        trim: true
      },
      model: {
        type: String,
        trim: true
      },
      make: {
        type: String,
        trim: true
      },
      year: {
        type: Number
      },
      color: {
        type: String,
        trim: true
      },
      licensePlate: {
        type: String,
        trim: true
      }
    },
    documents: {
      driverLicense: {
        type: String,
        trim: true
      },
      vehicleRegistration: {
        type: String,
        trim: true
      },
      insurance: {
        type: String,
        trim: true
      },
      profilePhoto: {
        type: String,
        trim: true
      }
    },
    bankingInfo: {
      accountNumber: {
        type: String,
        trim: true
      },
      routingNumber: {
        type: String,
        trim: true
      },
      taxId: {
        type: String,
        trim: true
      }
    },
    applicationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review'],
      default: 'pending'
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    approvalDate: {
      type: Date
    },
    currentLocation: {
      latitude: {
        type: Number
      },
      longitude: {
        type: Number
      },
      lastUpdated: {
        type: Date
      }
    }
  },
  deviceTokens: [{
    token: {
      type: String,
      trim: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web']
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  },
  lastLoginDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save hook to hash the password
userSchema.pre('save', async function(next) {
  const user = this;
  
  if (user.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  
  next();
});

// Method to validate password
userSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Method to get user profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  
  delete user.password;
  delete user.__v;
  
  return user;
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email });
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  const isMatch = await user.validatePassword(password);
  
  if (!isMatch) {
    throw new Error('Invalid login credentials');
  }
  
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 