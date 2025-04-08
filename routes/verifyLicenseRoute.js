const express = require('express');
const router = express.Router();
const { verifyLicense1, verifyLicense2 } = require('../controllers/VerifyLicenseController');

// ==============================
// POST routes
// ==============================

// ใช้ฟังก์ชันจาก controllers/VerifyLicenseController.js
router.post('/verify-license1', verifyLicense1);  // เรียกใช้งานฟังก์ชัน verifyLicense1 จาก controller
router.post('/verify-license2', verifyLicense2);  // เรียกใช้งานฟังก์ชัน verifyLicense2 จาก controller

module.exports = router;
