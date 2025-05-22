# IShare Ride-Sharing App - Backend

This is the backend API server for the IShare ride-sharing application. It provides REST API endpoints and WebSocket connections for real-time ride sharing functionality.

## Features

- User authentication (riders and drivers)
- Ride requests and matching with nearby drivers
- Real-time location tracking using WebSockets
- Fare calculation based on distance (20 taka/km)
- Ride history and statistics
- Payment processing (simulated)
- Push notifications

## Technology Stack

- Node.js and Express.js
- MongoDB with Mongoose ORM
- Socket.IO for real-time communication
- JWT for authentication
- Google Maps API for geocoding and directions

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Google Maps API Key

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Connection String
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ishare?retryWrites=true&w=majority

   # JWT Secret for Authentication
   JWT_SECRET=your-jwt-secret-key-change-in-production
   JWT_EXPIRES_IN=7d

   # Google Maps API Configuration
   MAPS_API_KEY=your-google-maps-api-key
   MAPS_API_URL=https://maps.gomaps.pro

   # Socket.IO Configuration
   SOCKET_CORS_ORIGIN=*
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile

### Rides
- `GET /api/rides/options` - Get available ride options
- `POST /api/rides/estimate` - Estimate ride price
- `POST /api/rides/request` - Request a new ride
- `PUT /api/rides/:rideId/cancel` - Cancel a ride
- `GET /api/rides/history` - Get ride history
- `GET /api/rides/:rideId` - Get ride details
- `POST /api/rides/:rideId/rate` - Rate a ride

### Drivers
- `PUT /api/drivers/availability` - Update driver availability
- `PUT /api/drivers/location` - Update driver location
- `PUT /api/drivers/rides/:rideId/accept` - Accept a ride
- `PUT /api/drivers/rides/:rideId/arrive` - Arrive at pickup
- `PUT /api/drivers/rides/:rideId/start` - Start a ride
- `PUT /api/drivers/rides/:rideId/complete` - Complete a ride
- `GET /api/drivers/rides` - Get driver ride history

## WebSocket Events

### Authentication
- `authenticate` - Authenticate user with WebSocket
- `authenticated` - Confirmation of authentication

### Location Updates
- `update_location` - Update user/driver location
- `driver_location_update` - Broadcast driver location to rider
- `rider_location_update` - Send rider location to driver
- `request_driver_movement` - Request driver movement history
- `driver_movement_history` - Send driver movement history

### Ride Flow
- `ride_request` - Request a new ride
- `ride_request_received` - Confirmation of ride request
- `driver_assigned` - Notify rider of driver assignment
- `ride_assigned` - Notify driver of ride assignment
- `driver_accepted` - Driver accepted the ride
- `driver_arrived` - Driver arrived at pickup
- `ride_started` - Ride has started
- `ride_completed` - Ride has been completed
- `fare_update` - Update on fare during ride
- `cancel_ride` - Cancel a ride
- `ride_cancelled` - Notification of ride cancellation

## Fare Calculation

The fare is calculated based on distance traveled:
- Base rate: 20 taka per kilometer
- Minimum fare: 50 taka
- Premium rides: 1.5x multiplier
- Shared rides: 0.8x multiplier

## Deployment

This backend is designed to be deployed on Vercel:

1. Install Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Deploy to Vercel:
   ```
   vercel --prod
   ```

## License

This project is licensed under the MIT License.