/**
 * Maps API Configuration
 */
const mapsConfig = {
  // Base URL for Google Maps API (can be updated to alternative provider)
  baseUrl: process.env.MAPS_API_URL || 'https://maps.gomaps.pro',
  
  // API Key for Maps services
  apiKey: process.env.MAPS_API_KEY,
  
  // Distance calculation
  farePerKm: 20, // 20 taka per kilometer
  minimumFare: 50, // Minimum fare for any ride
  
  // Ride options and multipliers
  rideOptions: {
    standard: {
      multiplier: 1.0,
      description: 'Standard ride'
    },
    premium: {
      multiplier: 1.5,
      description: 'Premium ride with nicer vehicles'
    },
    shared: {
      multiplier: 0.8,
      description: 'Shared ride with other passengers'
    }
  }
};

module.exports = mapsConfig; 