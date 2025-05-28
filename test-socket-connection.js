const { io } = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:5000';
const TEST_USER_ID = 'test_user_123';
const TEST_DRIVER_ID = 'test_driver_456';

console.log('=== Socket Connection Test ===');
console.log(`Connecting to: ${SERVER_URL}`);

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

let testStep = 0;

// Customer socket events
customerSocket.on('connect', () => {
  console.log('✅ Customer connected to server');
  testStep++;
  
  setTimeout(() => {
    console.log('🔐 Customer authenticating...');
    customerSocket.emit('authenticate', {
      userId: TEST_USER_ID,
      userType: 'user'
    });
  }, 500);
});

customerSocket.on('authenticated', (data) => {
  console.log('✅ Customer authenticated:', data);
  testStep++;
});

customerSocket.on('ride_request_received', (data) => {
  console.log('✅ Customer: Ride request received:', data);
  testStep++;
});

customerSocket.on('driver_accepted', (data) => {
  console.log('✅ Customer: Driver accepted ride:', data);
  testStep++;
  
  setTimeout(() => {
    console.log('🏁 Test completed successfully!');
    console.log(`Total steps completed: ${testStep}`);
    cleanup();
  }, 2000);
});

customerSocket.on('ride_request_error', (data) => {
  console.log('❌ Customer: Ride request error:', data);
});

// Driver socket events
driverSocket.on('connect', () => {
  console.log('✅ Driver connected to server');
  testStep++;
  
  setTimeout(() => {
    console.log('🔐 Driver authenticating...');
    driverSocket.emit('authenticate', {
      userId: TEST_DRIVER_ID,
      userType: 'driver'
    });
  }, 500);
});

driverSocket.on('authenticated', (data) => {
  console.log('✅ Driver authenticated:', data);
  testStep++;
  
  setTimeout(() => {
    console.log('🟢 Driver going online...');
    driverSocket.emit('driver_status_update', {
      driverId: TEST_DRIVER_ID,
      isOnline: true,
      location: {
        latitude: 23.8103,
        longitude: 90.4125
      }
    });
  }, 500);
});

driverSocket.on('driver_status_updated', (data) => {
  console.log('✅ Driver status updated:', data);
  testStep++;
  
  if (data.isOnline) {
    setTimeout(() => {
      console.log('🚗 Sending ride request from customer...');
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
    }, 1000);
  }
});

driverSocket.on('ride_assigned', (data) => {
  console.log('✅ Driver: Received ride request:', data);
  testStep++;
  
  setTimeout(() => {
    console.log('✅ Driver accepting ride...');
    driverSocket.emit('driver_accept_ride', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 2000);
});

driverSocket.on('ride_action_success', (data) => {
  console.log('✅ Driver: Ride action successful:', data);
  testStep++;
});

driverSocket.on('ride_action_error', (data) => {
  console.log('❌ Driver: Ride action error:', data);
});

driverSocket.on('ride_taken', (data) => {
  console.log('ℹ️ Driver: Ride was taken by another driver:', data);
});

// Error handling
customerSocket.on('connect_error', (error) => {
  console.error('❌ Customer connection error:', error.message);
});

driverSocket.on('connect_error', (error) => {
  console.error('❌ Driver connection error:', error.message);
});

customerSocket.on('disconnect', (reason) => {
  console.log('⚠️ Customer disconnected:', reason);
});

driverSocket.on('disconnect', (reason) => {
  console.log('⚠️ Driver disconnected:', reason);
});

// Cleanup function
function cleanup() {
  console.log('🧹 Cleaning up connections...');
  customerSocket.disconnect();
  driverSocket.disconnect();
  process.exit(0);
}

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏱️ Test timeout reached');
  console.log(`Steps completed: ${testStep}`);
  if (testStep < 6) {
    console.log('❌ Test failed - not all steps completed');
  }
  cleanup();
}, 30000);

console.log('⏳ Starting test sequence...'); 