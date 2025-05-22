/**
 * WebSocket Connection Test File
 * 
 * This file can be used to test the WebSocket connection from the server side.
 * Run it with node socket-test.js
 */

const { Server } = require('socket.io');
const http = require('http');

const testSocketConnection = () => {
  // Create a basic HTTP server
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.IO test server');
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',  // Allow all origins
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Log socket connections
  io.on('connection', (socket) => {
    console.log('📱 New client connected:', socket.id);
    
    // Send welcome message to client
    socket.emit('welcome', { message: 'Connected to IShare WebSocket server!' });
    
    // Log client disconnections
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
    
    // Log authentication attempts
    socket.on('authenticate', (data) => {
      console.log('🔐 Authentication attempt:', data);
      socket.emit('authenticated', { userId: data.userId, userType: data.userType });
    });
    
    // Echo any message back to client
    socket.on('echo', (data) => {
      console.log('📣 Echo received:', data);
      socket.emit('echo_response', data);
    });
    
    // Log ride requests
    socket.on('ride_request', (data) => {
      console.log('🚗 Ride request received:', data);
      
      // Simulate driver found after 3 seconds
      setTimeout(() => {
        socket.emit('driver_assigned', {
          driverId: 'driver123',
          driverName: 'John Driver',
          driverRating: 4.8,
          estimatedArrival: '3 minutes',
          vehicleDetails: {
            model: 'Toyota Camry',
            color: 'Silver',
            licensePlate: 'ABC123'
          }
        });
      }, 3000);
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Socket.IO test server running on port ${PORT}`);
    console.log(`WebSocket URL: ws://localhost:${PORT}`);
    console.log('Use this URL in your frontend socketService.ts configuration');
  });
};

// Execute if this file is run directly
if (require.main === module) {
  testSocketConnection();
}

module.exports = { testSocketConnection }; 