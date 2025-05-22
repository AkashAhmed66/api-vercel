const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/user.model');
const RideOption = require('../models/rideOption.model');

// Load env variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create admin user
const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@ishare.com' });
    
    if (adminExists) {
      console.log('Admin user already exists');
      return;
    }
    
    // Create admin user
    const admin = new User({
      name: 'Admin User',
      email: 'admin@ishare.com',
      password: 'admin123',
      phone: '+1234567890',
      role: 'admin',
      isVerified: true,
      accountStatus: 'active'
    });
    
    await admin.save();
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create ride options
const createRideOptions = async () => {
  try {
    // Check if ride options already exist
    const optionsExist = await RideOption.countDocuments();
    
    if (optionsExist > 0) {
      console.log('Ride options already exist');
      return;
    }
    
    // Ride options data
    const rideOptions = [
      {
        name: 'standard',
        description: 'Affordable rides for everyday use',
        basePrice: 2.5,
        pricePerKm: 0.8,
        pricePerMinute: 0.2,
        capacity: 4,
        imageUrl: '/images/rides/standard.png',
        minimumFare: 5,
        order: 1
      },
      {
        name: 'premium',
        description: 'Luxury vehicles for a premium experience',
        basePrice: 5,
        pricePerKm: 1.2,
        pricePerMinute: 0.3,
        capacity: 4,
        imageUrl: '/images/rides/premium.png',
        minimumFare: 10,
        order: 2
      },
      {
        name: 'xl',
        description: 'Larger vehicles for groups or extra luggage',
        basePrice: 3.5,
        pricePerKm: 1.0,
        pricePerMinute: 0.25,
        capacity: 6,
        imageUrl: '/images/rides/xl.png',
        minimumFare: 7,
        order: 3
      },
      {
        name: 'shared',
        description: 'Share your ride with others and save money',
        basePrice: 1.5,
        pricePerKm: 0.6,
        pricePerMinute: 0.15,
        capacity: 2,
        imageUrl: '/images/rides/shared.png',
        minimumFare: 3,
        order: 4
      }
    ];
    
    // Insert ride options
    await RideOption.insertMany(rideOptions);
    console.log('Ride options created successfully');
  } catch (error) {
    console.error('Error creating ride options:', error);
  }
};

// Create test users
const createTestUsers = async () => {
  try {
    // Check if test users already exist
    const testUserExists = await User.findOne({ email: 'user@ishare.com' });
    const testDriverExists = await User.findOne({ email: 'driver@ishare.com' });
    
    // Create test user if not exists
    if (!testUserExists) {
      const testUser = new User({
        name: 'Test User',
        email: 'user@ishare.com',
        password: 'user123',
        phone: '+1234567890',
        role: 'user',
        isVerified: true,
        accountStatus: 'active',
        homeAddress: {
          name: 'Home',
          address: '123 Main St, New York, NY',
          latitude: 40.7128,
          longitude: -74.0060,
          isDefault: true
        },
        workAddress: {
          name: 'Work',
          address: '456 Park Ave, New York, NY',
          latitude: 40.7580,
          longitude: -73.9855,
          isDefault: false
        },
        paymentMethods: [
          {
            type: 'credit_card',
            cardNumber: '************1234',
            cardHolderName: 'Test User',
            expiryMonth: 12,
            expiryYear: 2025,
            last4: '1234',
            brand: 'Visa',
            isDefault: true
          }
        ]
      });
      
      await testUser.save();
      console.log('Test user created successfully');
    } else {
      console.log('Test user already exists');
    }
    
    // Create test driver if not exists
    if (!testDriverExists) {
      const testDriver = new User({
        name: 'Test Driver',
        email: 'driver@ishare.com',
        password: 'driver123',
        phone: '+1987654321',
        role: 'driver',
        isVerified: true,
        accountStatus: 'active',
        driverInfo: {
          licenseNumber: 'DL12345678',
          licenseExpiryDate: new Date('2025-12-31'),
          vehicleDetails: {
            model: 'Toyota Camry',
            make: 'Toyota',
            year: 2021,
            color: 'Black',
            licensePlate: 'ABC123'
          },
          isActive: true,
          isVerified: true,
          currentLocation: {
            latitude: 40.7128,
            longitude: -74.0060,
            lastUpdated: new Date()
          }
        },
        rating: {
          average: 4.8,
          count: 25
        }
      });
      
      await testDriver.save();
      console.log('Test driver created successfully');
    } else {
      console.log('Test driver already exists');
    }
  } catch (error) {
    console.error('Error creating test users:', error);
  }
};

// Main function to run all seed operations
const seedDatabase = async () => {
  // Connect to MongoDB
  await connectDB();
  
  // Seed data
  await createAdminUser();
  await createRideOptions();
  await createTestUsers();
  
  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Database seeding completed');
  
  process.exit(0);
};

// Run the seed function
seedDatabase(); 