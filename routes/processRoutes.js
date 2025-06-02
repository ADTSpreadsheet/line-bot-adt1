const express = require('express');
const router = express.Router();

// Import Controller
const { processOrder } = require('../controllers/processOrderController');

// Route สำหรับรับคำสั่งจาก API2
router.post('/process-order', processOrder);

// Route สำหรับอนุมัติ (รับจาก API2)
router.post('/approve-order', (req, res) => {
  req.body.status = 'Ap'; // กำหนด status เป็น Ap
  processOrder(req, res);
});

// Route สำหรับปฏิเสธ (รับจาก API2)  
router.post('/reject-order', (req, res) => {
  req.body.status = 'Rj'; // กำหนด status เป็น Rj
  processOrder(req, res);
});

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'API1 (Main Application) is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
