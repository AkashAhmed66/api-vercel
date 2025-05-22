const User = require('../models/user.model');
const { validationResult } = require('express-validator');

/**
 * Update user profile
 * @route PUT /api/users/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { name, phone, profilePic } = req.body;
    const user = req.user;

    // Update user fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (profilePic) user.profilePic = profilePic;

    // Save updated user
    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Failed to update profile' 
    });
  }
};

/**
 * Add a saved place
 * @route POST /api/users/places
 * @access Private
 */
const addSavedPlace = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { name, address, latitude, longitude, isDefault } = req.body;
    const user = req.user;

    // Create new saved place
    const newPlace = {
      name,
      address,
      latitude,
      longitude,
      isDefault: isDefault || false
    };

    // If this is marked as home address
    if (name.toLowerCase() === 'home') {
      user.homeAddress = newPlace;
    } 
    // If this is marked as work address
    else if (name.toLowerCase() === 'work') {
      user.workAddress = newPlace;
    } 
    // Otherwise, add to saved places
    else {
      user.savedPlaces.push(newPlace);
    }

    // Save user
    await user.save();

    res.status(201).json({
      message: 'Place saved successfully',
      place: newPlace,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Add saved place error:', error);
    res.status(500).json({ 
      message: 'Failed to save place' 
    });
  }
};

/**
 * Remove a saved place
 * @route DELETE /api/users/places/:placeId
 * @access Private
 */
const removeSavedPlace = async (req, res) => {
  try {
    const placeId = req.params.placeId;
    const user = req.user;

    // Find the place in the user's saved places
    const placeIndex = user.savedPlaces.findIndex(place => place._id.toString() === placeId);

    if (placeIndex === -1) {
      return res.status(404).json({ 
        message: 'Saved place not found' 
      });
    }

    // Remove the place
    user.savedPlaces.splice(placeIndex, 1);

    // Save user
    await user.save();

    res.status(200).json({
      message: 'Place removed successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Remove saved place error:', error);
    res.status(500).json({ 
      message: 'Failed to remove place' 
    });
  }
};

/**
 * Add a payment method
 * @route POST /api/users/payment-methods
 * @access Private
 */
const addPaymentMethod = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { 
      type, 
      cardNumber, 
      cardHolderName, 
      expiryMonth, 
      expiryYear, 
      last4, 
      brand, 
      isDefault 
    } = req.body;
    
    const user = req.user;

    // Create new payment method
    const newPaymentMethod = {
      type,
      isDefault: isDefault || false
    };

    // Add card-specific fields if it's a card
    if (type === 'credit_card' || type === 'debit_card') {
      newPaymentMethod.cardNumber = cardNumber;
      newPaymentMethod.cardHolderName = cardHolderName;
      newPaymentMethod.expiryMonth = expiryMonth;
      newPaymentMethod.expiryYear = expiryYear;
      newPaymentMethod.last4 = last4;
      newPaymentMethod.brand = brand;
    }

    // If this is the default payment method, set all others to non-default
    if (isDefault) {
      user.paymentMethods.forEach(method => {
        method.isDefault = false;
      });
    }

    // Add the new payment method
    user.paymentMethods.push(newPaymentMethod);

    // Save user
    await user.save();

    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ 
      message: 'Failed to add payment method' 
    });
  }
};

/**
 * Remove a payment method
 * @route DELETE /api/users/payment-methods/:methodId
 * @access Private
 */
const removePaymentMethod = async (req, res) => {
  try {
    const methodId = req.params.methodId;
    const user = req.user;

    // Find the payment method in the user's payment methods
    const methodIndex = user.paymentMethods.findIndex(method => method._id.toString() === methodId);

    if (methodIndex === -1) {
      return res.status(404).json({ 
        message: 'Payment method not found' 
      });
    }

    // Check if it's the only payment method
    if (user.paymentMethods.length === 1) {
      return res.status(400).json({ 
        message: 'Cannot remove the only payment method' 
      });
    }

    // Check if it's the default payment method
    if (user.paymentMethods[methodIndex].isDefault) {
      // Set another payment method as default
      const nextMethod = user.paymentMethods.find(method => method._id.toString() !== methodId);
      if (nextMethod) {
        nextMethod.isDefault = true;
      }
    }

    // Remove the payment method
    user.paymentMethods.splice(methodIndex, 1);

    // Save user
    await user.save();

    res.status(200).json({
      message: 'Payment method removed successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Remove payment method error:', error);
    res.status(500).json({ 
      message: 'Failed to remove payment method' 
    });
  }
};

/**
 * Set a payment method as default
 * @route PUT /api/users/payment-methods/:methodId/default
 * @access Private
 */
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const methodId = req.params.methodId;
    const user = req.user;

    // Find the payment method in the user's payment methods
    const methodIndex = user.paymentMethods.findIndex(method => method._id.toString() === methodId);

    if (methodIndex === -1) {
      return res.status(404).json({ 
        message: 'Payment method not found' 
      });
    }

    // Set all methods to non-default
    user.paymentMethods.forEach(method => {
      method.isDefault = false;
    });

    // Set the selected method as default
    user.paymentMethods[methodIndex].isDefault = true;

    // Save user
    await user.save();

    res.status(200).json({
      message: 'Default payment method updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({ 
      message: 'Failed to update default payment method' 
    });
  }
};

/**
 * Change password
 * @route PUT /api/users/password
 * @access Private
 */
const changePassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isMatch = await user.validatePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;

    // Save user
    await user.save();

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Failed to change password' 
    });
  }
};

module.exports = {
  updateProfile,
  addSavedPlace,
  removeSavedPlace,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  changePassword
}; 