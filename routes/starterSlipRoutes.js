const express = require('express');
const router = express.Router();

// 👇 import controller ที่เราสร้างไว้
const submitStarterSlip = require('../controllers/submitStarterSlip');

// ✅ สร้าง Route สำหรับรับ POST จากฝั่งเว็บ (หรือ VBA)
router.post('/submit-starter-slip', submitStarterSlip);

module.exports = router;
