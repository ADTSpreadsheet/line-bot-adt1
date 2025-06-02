const express = require('express');
const router = express.Router();

// Import Controller
const { processOrder } = require('../controllers/processOrderController');

// Route สำหรับรับคำสั่งจาก API2
router.post('/process-order', processOrder);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'API1 (Main Application) is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
