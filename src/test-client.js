/**
 * WebSocket Test Client
 * Use this script to test WebSocket connectivity with the server
 */

const { io } = require('socket.io-client');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default URL (can be overridden via command line)
const url = process.argv[2] || 'http://localhost:5000';

console.log(`Connecting to ${url}...`);
const socket = io(url, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  timeout: 10000
});

// Connection events
socket.on('connect', () => {
  console.log(`Connected! Socket ID: ${socket.id}`);
  showMenu();
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
});

// Welcome message
socket.on('welcome', (data) => {
  console.log(`Server says: ${data.message}`);
});

// Authentication response
socket.on('authenticated', (data) => {
  console.log('Authentication successful:', data);
});

// Driver assigned event
socket.on('driver_assigned', (data) => {
  console.log('Driver assigned:', JSON.stringify(data, null, 2));
});

// Driver location update
socket.on('driver_location_update', (data) => {
  console.log('Driver location update:', JSON.stringify(data, null, 2));
});

// Generic notification
socket.on('notification', (data) => {
  console.log('Notification received:', JSON.stringify(data, null, 2));
});

// Ride request confirmation
socket.on('ride_request_received', (data) => {
  console.log('Ride request confirmation:', JSON.stringify(data, null, 2));
});

// Echo response
socket.on('echo_response', (data) => {
  console.log('Echo response:', data);
});

// Function to show menu
function showMenu() {
  console.log('\n===== TEST MENU =====');
  console.log('1. Authenticate as rider');
  console.log('2. Authenticate as driver');
  console.log('3. Send ride request');
  console.log('4. Update location');
  console.log('5. Send echo message');
  console.log('6. Disconnect');
  console.log('0. Exit');
  
  rl.question('Select option: ', (answer) => {
    switch (answer) {
      case '1':
        authenticateAsRider();
        break;
      case '2':
        authenticateAsDriver();
        break;
      case '3':
        sendRideRequest();
        break;
      case '4':
        updateLocation();
        break;
      case '5':
        sendEchoMessage();
        break;
      case '6':
        socket.disconnect();
        showMenu();
        break;
      case '0':
        console.log('Exiting...');
        socket.disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option');
        showMenu();
    }
  });
}

// Authenticate as rider
function authenticateAsRider() {
  rl.question('Enter rider ID (or leave blank for test123): ', (userId) => {
    userId = userId || 'test123';
    
    socket.emit('authenticate', { userId, userType: 'passenger' });
    console.log(`Authentication request sent as rider: ${userId}`);
    showMenu();
  });
}

// Authenticate as driver
function authenticateAsDriver() {
  rl.question('Enter driver ID (or leave blank for driver123): ', (userId) => {
    userId = userId || 'driver123';
    
    socket.emit('authenticate', { userId, userType: 'driver' });
    console.log(`Authentication request sent as driver: ${userId}`);
    showMenu();
  });
}

// Send ride request
function sendRideRequest() {
  const rideDetails = {
    userId: 'test123',
    pickupLocation: {
      latitude: 23.7808,
      longitude: 90.4093,
      name: 'Dhaka University',
      address: 'Dhaka University, Dhaka 1000, Bangladesh'
    },
    dropoffLocation: {
      latitude: 23.7934,
      longitude: 90.4024,
      name: 'Dhaka Medical College',
      address: 'Dhaka Medical College, Dhaka 1000, Bangladesh'
    },
    rideType: 'standard',
    paymentMethod: 'cash'
  };
  
  socket.emit('ride_request', rideDetails);
  console.log('Ride request sent');
  showMenu();
}

// Update location
function updateLocation() {
  rl.question('Enter latitude (default: 23.7934): ', (lat) => {
    const latitude = parseFloat(lat || '23.7934');
    
    rl.question('Enter longitude (default: 90.4024): ', (lng) => {
      const longitude = parseFloat(lng || '90.4024');
      
      socket.emit('update_location', {
        userId: socket.auth?.userId || 'test123',
        location: { latitude, longitude }
      });
      
      console.log(`Location update sent: ${latitude}, ${longitude}`);
      showMenu();
    });
  });
}

// Send echo message
function sendEchoMessage() {
  rl.question('Enter message to echo: ', (message) => {
    socket.emit('echo', { message });
    console.log(`Echo message sent: ${message}`);
    showMenu();
  });
}

// Run the client
console.log('IShare WebSocket Test Client');
console.log('---------------------------'); 