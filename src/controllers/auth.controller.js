const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt');
const { validationResult } = require('express-validator');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { name, email, password, phone, role = 'user' } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        message: 'An account with this email already exists' 
      });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      role
    });

    // Save user to database
    await user.save();

    // Generate JWT token and refresh token
    const token = generateToken(user);
    const refreshToken = generateToken(user, '30d'); // Longer expiry for refresh token

    // Return user data (excluding password) and token
    res.status(201).json({
      message: 'User registered successfully',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid input data'
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(503).json({
        message: 'Database connection error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
      });
    }
    
    res.status(500).json({ 
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  try {
    console.log(req.body);
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user by credentials (email and password)
    const user = await User.findByCredentials(email, password);

    // Check if account is active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        message: 'Account is not active',
        status: user.accountStatus
      });
    }

    // Update last login date
    user.lastLoginDate = new Date();
    await user.save();

    // Generate JWT token and refresh token
    const token = generateToken(user);
    const refreshToken = generateToken(user, '30d'); // Longer expiry for refresh token

    // Return user data (excluding password) and token
    res.status(200).json({
      message: 'Login successful',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      message: 'Invalid login credentials' 
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
const getCurrentUser = async (req, res) => {
  try {
    res.status(200).json({
      user: req.user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      message: 'Failed to get user profile' 
    });
  }
};

/**
 * Logout user (invalidate token on client-side)
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = async (req, res) => {
  try {
    // Note: JWT tokens cannot be invalidated on the server-side.
    // The client should remove the token from storage.
    
    // In a real-world implementation, you might want to add the token to a blacklist
    // or use Redis to track invalidated tokens until they expire.
    
    res.status(200).json({ 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'Logout failed' 
    });
  }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, don't reveal if the email exists
      return res.status(200).json({ 
        message: 'If your email is registered, you will receive a password reset link' 
      });
    }

    // In a real implementation, you would:
    // 1. Generate a password reset token
    // 2. Save it to the user record with an expiry
    // 3. Send an email with the reset link
    
    res.status(200).json({ 
      message: 'If your email is registered, you will receive a password reset link' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      message: 'Failed to process request' 
    });
  }
};

/**
 * Reset password with token
 * @route POST /api/auth/reset-password
 * @access Public
 */
const resetPassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { token, password } = req.body;

    // In a real implementation, you would:
    // 1. Verify the reset token
    // 2. Check if it's expired
    // 3. Update the user's password
    // 4. Remove the reset token
    
    // For demonstration purposes:
    res.status(200).json({ 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: 'Failed to reset password' 
    });
  }
};

/**
 * Verify email with token
 * @route POST /api/auth/verify-email
 * @access Public
 */
const verifyEmail = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { token } = req.body;

    // In a real implementation, you would:
    // 1. Verify the email verification token
    // 2. Check if it's expired
    // 3. Update the user's isVerified status
    // 4. Remove the verification token
    
    // For demonstration purposes, accept any token:
    res.status(200).json({ 
      message: 'Email verified successfully' 
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Failed to verify email' 
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail
}; 