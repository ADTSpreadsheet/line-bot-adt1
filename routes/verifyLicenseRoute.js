const express = require('express');
const router = express.Router();
const { verifyLicense1, verifyLicense2 } = require('../controllers/VerifyLicenseController');

// ===========================
// POST routes
// ===========================

// ใช้ฟังก์ชันจาก controller
router.post('/verify-license1', verifyLicense1);
router.post('/verify-license2', verifyLicense2);

module.exports = router;
