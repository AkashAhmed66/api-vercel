const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Upload single file
router.post(
  '/',
  uploadController.upload.single('file'),
  uploadController.uploadFile
);

// Upload multiple files
router.post(
  '/multiple',
  uploadController.upload.array('files', 5), // Max 5 files
  uploadController.uploadMultiple
);

// Delete file
router.delete('/:filename', uploadController.deleteFile);

module.exports = router; 