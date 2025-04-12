// routes/setupUsernameRoute.js

const express = require('express');
const router = express.Router();

const { setupUsername } = require('../controllers/setupUsernameController');

// Endpoint สำหรับตั้งค่า Username และบันทึกข้อมูลทั้งหมด
router.post('/Setup-Username', setupUsername);

module.exports = router;
