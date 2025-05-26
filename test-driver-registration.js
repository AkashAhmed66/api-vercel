const axios = require('axios');

const API_BASE = 'http://localhost:5000';

// Test data
const testUser = {
  name: 'Test Driver',
  email: 'testdriver@example.com',
  password: 'password123',
  phone: '+1234567890'
};

const testDriverData = {
  licenseNumber: 'DL123456789',
  licenseExpiryDate: '2025-12-31',
  vehicleDetails: {
    type: 'sedan',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    color: 'White',
    licensePlate: 'ABC123'
  },
  documents: {
    driverLicense: 'uploaded',
    vehicleRegistration: 'uploaded',
    insurance: 'uploaded',
    profilePhoto: 'uploaded'
  },
  bankingInfo: {
    accountNumber: '1234567890',
    routingNumber: '123456789',
    taxId: '123-45-6789'
  }
};

async function testDriverRegistration() {
  try {
    console.log('🚀 Testing Driver Registration Flow...\n');

    // Step 1: Register a new user
    console.log('1. Registering new user...');
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, testUser);
    console.log('✅ User registered successfully');
    
    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Step 2: Register as driver
    console.log('\n2. Registering user as driver...');
    const driverResponse = await axios.post(
      `${API_BASE}/api/drivers/register`,
      testDriverData,
      { headers }
    );
    
    console.log('✅ Driver registration successful!');
    console.log('Response:', JSON.stringify(driverResponse.data, null, 2));

    // Step 3: Verify user role changed
    console.log('\n3. Verifying user profile...');
    const profileResponse = await axios.get(`${API_BASE}/api/auth/me`, { headers });
    
    console.log('✅ User profile verified');
    console.log('User role:', profileResponse.data.user.role);
    console.log('Driver status:', profileResponse.data.user.driverInfo?.applicationStatus);

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testDriverRegistration(); 