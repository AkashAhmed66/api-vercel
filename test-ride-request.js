const { io } = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:5000';
const TEST_USER_ID = 'test_user_123';
const TEST_DRIVER_ID = 'test_driver_456';

console.log('Starting ride request test...');

// Create customer socket
const customerSocket = io(SERVER_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// Create driver socket
const driverSocket = io(SERVER_URL, {
  transports: ['websocket'],
  autoConnect: true
});

// Customer socket events
customerSocket.on('connect', () => {
  console.log('Customer connected to server');
  
  // Authenticate as customer
  customerSocket.emit('authenticate', {
    userId: TEST_USER_ID,
    userType: 'user'
  });
});

customerSocket.on('authenticated', (data) => {
  console.log('Customer authenticated:', data);
});

customerSocket.on('ride_request_received', (data) => {
  console.log('Customer: Ride request received:', data);
});

customerSocket.on('driver_accepted', (data) => {
  console.log('Customer: Driver accepted ride:', data);
});

customerSocket.on('ride_request_error', (data) => {
  console.log('Customer: Ride request error:', data);
});

// Driver socket events
driverSocket.on('connect', () => {
  console.log('Driver connected to server');
  
  // Authenticate as driver
  driverSocket.emit('authenticate', {
    userId: TEST_DRIVER_ID,
    userType: 'driver'
  });
});

driverSocket.on('authenticated', (data) => {
  console.log('Driver authenticated:', data);
  
  // Wait a moment then go online
  setTimeout(() => {
    console.log('Driver going online...');
    driverSocket.emit('driver_status_update', {
      driverId: TEST_DRIVER_ID,
      isOnline: true,
      location: {
        latitude: 23.8103,
        longitude: 90.4125
      }
    });
  }, 1000);
});

driverSocket.on('driver_status_updated', (data) => {
  console.log('Driver status updated:', data);
  
  // After driver is online, send a ride request from customer
  if (data.isOnline) {
    setTimeout(() => {
      console.log('Sending ride request from customer...');
      
      customerSocket.emit('ride_request', {
        userId: TEST_USER_ID,
        pickupLocation: {
          latitude: 23.8103,
          longitude: 90.4125,
          address: "Dhanmondi, Dhaka"
        },
        dropoffLocation: {
          latitude: 23.7749,
          longitude: 90.3885,
          address: "Gulshan, Dhaka"
        },
        rideType: 'standard',
        paymentMethod: 'cash',
        estimatedPrice: 150,
        estimatedDistance: 5.2
      });
    }, 2000);
  }
});

driverSocket.on('ride_assigned', (data) => {
  console.log('Driver: Received ride request:', data);
  
  // Accept the ride after 3 seconds
  setTimeout(() => {
    console.log('Driver accepting ride...');
    driverSocket.emit('driver_accept_ride', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 3000);
});

driverSocket.on('ride_action_success', (data) => {
  console.log('Driver: Ride action successful:', data);
});

driverSocket.on('ride_action_error', (data) => {
  console.log('Driver: Ride action error:', data);
});

driverSocket.on('ride_taken', (data) => {
  console.log('Driver: Ride was taken by another driver:', data);
});

// Error handling
customerSocket.on('connect_error', (error) => {
  console.error('Customer connection error:', error);
});

driverSocket.on('connect_error', (error) => {
  console.error('Driver connection error:', error);
});

// Cleanup after 60 seconds
setTimeout(() => {
  console.log('Test completed. Cleaning up...');
  customerSocket.disconnect();
  driverSocket.disconnect();
  process.exit(0);
}, 60000); 