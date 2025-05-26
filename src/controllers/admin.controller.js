const User = require('../models/user.model');
const { validationResult } = require('express-validator');

/**
 * Get all driver applications
 * @route GET /api/admin/drivers/applications
 * @access Private (Admin)
 */
const getDriverApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = { role: 'driver' };
    if (status) {
      query['driverInfo.applicationStatus'] = status;
    }

    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await User.countDocuments(query);
    
    // Get driver applications
    const drivers = await User.find(query)
      .select('-password')
      .sort({ 'driverInfo.registrationDate': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      drivers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get driver applications error:', error);
    res.status(500).json({ 
      message: 'Failed to get driver applications' 
    });
  }
};

/**
 * Approve a driver application
 * @route PUT /api/admin/drivers/:driverId/approve
 * @access Private (Admin)
 */
const approveDriverApplication = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { notes } = req.body;

    const driver = await User.findOne({
      _id: driverId,
      role: 'driver'
    });

    if (!driver) {
      return res.status(404).json({ 
        message: 'Driver not found' 
      });
    }

    if (driver.driverInfo.applicationStatus === 'approved') {
      return res.status(400).json({ 
        message: 'Driver application is already approved' 
      });
    }

    // Approve the driver
    driver.driverInfo.applicationStatus = 'approved';
    driver.driverInfo.isVerified = true;
    driver.driverInfo.approvalDate = new Date();
    
    if (notes) {
      driver.driverInfo.adminNotes = notes;
    }

    await driver.save();

    res.status(200).json({
      message: 'Driver application approved successfully',
      driver: driver.getPublicProfile()
    });

    // TODO: Send notification to driver about approval
  } catch (error) {
    console.error('Approve driver application error:', error);
    res.status(500).json({ 
      message: 'Failed to approve driver application' 
    });
  }
};

/**
 * Reject a driver application
 * @route PUT /api/admin/drivers/:driverId/reject
 * @access Private (Admin)
 */
const rejectDriverApplication = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        message: 'Rejection reason is required' 
      });
    }

    const driver = await User.findOne({
      _id: driverId,
      role: 'driver'
    });

    if (!driver) {
      return res.status(404).json({ 
        message: 'Driver not found' 
      });
    }

    if (driver.driverInfo.applicationStatus === 'rejected') {
      return res.status(400).json({ 
        message: 'Driver application is already rejected' 
      });
    }

    // Reject the driver
    driver.driverInfo.applicationStatus = 'rejected';
    driver.driverInfo.isVerified = false;
    driver.driverInfo.rejectionReason = reason;
    driver.driverInfo.rejectionDate = new Date();

    await driver.save();

    res.status(200).json({
      message: 'Driver application rejected',
      driver: driver.getPublicProfile()
    });

    // TODO: Send notification to driver about rejection
  } catch (error) {
    console.error('Reject driver application error:', error);
    res.status(500).json({ 
      message: 'Failed to reject driver application' 
    });
  }
};

/**
 * Suspend a driver
 * @route PUT /api/admin/drivers/:driverId/suspend
 * @access Private (Admin)
 */
const suspendDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        message: 'Suspension reason is required' 
      });
    }

    const driver = await User.findOne({
      _id: driverId,
      role: 'driver'
    });

    if (!driver) {
      return res.status(404).json({ 
        message: 'Driver not found' 
      });
    }

    // Suspend the driver
    driver.accountStatus = 'suspended';
    driver.driverInfo.isActive = false;
    driver.driverInfo.suspensionReason = reason;
    driver.driverInfo.suspensionDate = new Date();

    await driver.save();

    res.status(200).json({
      message: 'Driver suspended successfully',
      driver: driver.getPublicProfile()
    });

    // TODO: Send notification to driver about suspension
  } catch (error) {
    console.error('Suspend driver error:', error);
    res.status(500).json({ 
      message: 'Failed to suspend driver' 
    });
  }
};

/**
 * Reactivate a driver
 * @route PUT /api/admin/drivers/:driverId/reactivate
 * @access Private (Admin)
 */
const reactivateDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findOne({
      _id: driverId,
      role: 'driver'
    });

    if (!driver) {
      return res.status(404).json({ 
        message: 'Driver not found' 
      });
    }

    // Reactivate the driver
    driver.accountStatus = 'active';
    driver.driverInfo.suspensionReason = undefined;
    driver.driverInfo.suspensionDate = undefined;

    await driver.save();

    res.status(200).json({
      message: 'Driver reactivated successfully',
      driver: driver.getPublicProfile()
    });

    // TODO: Send notification to driver about reactivation
  } catch (error) {
    console.error('Reactivate driver error:', error);
    res.status(500).json({ 
      message: 'Failed to reactivate driver' 
    });
  }
};

/**
 * Get driver details
 * @route GET /api/admin/drivers/:driverId
 * @access Private (Admin)
 */
const getDriverDetails = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findOne({
      _id: driverId,
      role: 'driver'
    }).select('-password');

    if (!driver) {
      return res.status(404).json({ 
        message: 'Driver not found' 
      });
    }

    res.status(200).json({
      driver
    });
  } catch (error) {
    console.error('Get driver details error:', error);
    res.status(500).json({ 
      message: 'Failed to get driver details' 
    });
  }
};

module.exports = {
  getDriverApplications,
  approveDriverApplication,
  rejectDriverApplication,
  suspendDriver,
  reactivateDriver,
  getDriverDetails
}; 