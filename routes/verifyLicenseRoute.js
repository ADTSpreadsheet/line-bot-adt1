const express = require('express');
const router = express.Router();

const {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
} = require('../controllers/VerifyLicenseController');

// ===========================
// POST Routes
// ===========================
router.post('/verify-license1', verifyLicense1);
router.post('/verify-license2', verifyLicense2);
router.post('/verifyRefCodeAndSerial', verifyRefCodeAndSerial);

module.exports = router;
