const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:5000';
const TEST_USER_ID = 'test_user_123';
const TEST_DRIVER_ID = 'test_driver_456';

// Test locations
const PICKUP_LOCATION = {
  address: 'Dhaka University, Dhaka, Bangladesh',
  latitude: 23.7281,
  longitude: 90.3956
};

const DROPOFF_LOCATION = {
  address: 'Gulshan 1, Dhaka, Bangladesh',
  latitude: 23.7808,
  longitude: 90.4142
};

console.log('🚀 Starting Ride Booking System Test...\n');

// Create user (rider) connection
const userSocket = io(SERVER_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// Create driver connection
const driverSocket = io(SERVER_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// User socket events
userSocket.on('connect', () => {
  console.log('👤 User connected to server');
  
  // Authenticate as user
  userSocket.emit('authenticate', {
    userId: TEST_USER_ID,
    userType: 'user'
  });
});

userSocket.on('authenticated', (data) => {
  console.log('✅ User authenticated:', data);
  
  // Wait a bit then request a ride
  setTimeout(() => {
    console.log('\n🚗 Requesting a ride...');
    userSocket.emit('ride_request', {
      userId: TEST_USER_ID,
      pickupLocation: PICKUP_LOCATION,
      dropoffLocation: DROPOFF_LOCATION,
      rideType: 'standard',
      paymentMethod: 'cash',
      estimatedPrice: 150
    });
  }, 2000);
});

userSocket.on('ride_request_received', (data) => {
  console.log('📱 Ride request received by server:', data);
});

userSocket.on('driver_assigned', (data) => {
  console.log('🎯 Driver assigned to user:', data);
});

userSocket.on('ride_request_error', (data) => {
  console.log('❌ Ride request error:', data);
});

// Driver socket events
driverSocket.on('connect', () => {
  console.log('🚙 Driver connected to server');
  
  // Connect as driver
  driverSocket.emit('driver_connect', {
    driverId: TEST_DRIVER_ID,
    location: {
      latitude: 23.7500,
      longitude: 90.4000
    },
    isOnline: true
  });
});

driverSocket.on('driver_connected', (data) => {
  console.log('✅ Driver connected and online:', data);
});

driverSocket.on('ride_assigned', (data) => {
  console.log('🔔 New ride request for driver:', data);
  
  // Simulate driver accepting the ride after 3 seconds
  setTimeout(() => {
    console.log('✅ Driver accepting ride...');
    driverSocket.emit('driver_accepted', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 3000);
});

// Error handling
userSocket.on('connect_error', (error) => {
  console.log('❌ User connection error:', error.message);
});

driverSocket.on('connect_error', (error) => {
  console.log('❌ Driver connection error:', error.message);
});

// Cleanup after test
setTimeout(() => {
  console.log('\n🏁 Test completed. Disconnecting...');
  userSocket.disconnect();
  driverSocket.disconnect();
  process.exit(0);
}, 15000);

console.log('⏳ Test will run for 15 seconds...\n'); 