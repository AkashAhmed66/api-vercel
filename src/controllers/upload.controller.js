const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = req.body.folder || 'documents';
    const uploadPath = path.join(__dirname, '../../uploads', folder);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * Upload a single file
 * @route POST /api/upload
 * @access Private
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded'
      });
    }

    const fileUrl = `/uploads/${req.body.folder || 'documents'}/${req.file.filename}`;

    res.status(200).json({
      message: 'File uploaded successfully',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      message: 'File upload failed'
    });
  }
};

/**
 * Upload multiple files
 * @route POST /api/upload/multiple
 * @access Private
 */
const uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: 'No files uploaded'
      });
    }

    const files = req.files.map(file => ({
      url: `/uploads/${req.body.folder || 'documents'}/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: file.mimetype
    }));

    res.status(200).json({
      message: 'Files uploaded successfully',
      data: files
    });
  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(500).json({
      message: 'File upload failed'
    });
  }
};

/**
 * Delete a file
 * @route DELETE /api/upload/:filename
 * @access Private
 */
const deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { folder = 'documents' } = req.query;
    
    const filePath = path.join(__dirname, '../../uploads', folder, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.status(200).json({
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        message: 'File not found'
      });
    }
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      message: 'File deletion failed'
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  uploadMultiple,
  deleteFile
}; 