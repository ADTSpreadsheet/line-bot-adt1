const express = require('express');
const router = express.Router();

const { verifyLicense1 } = require('../controllers/VerifyLicenseController');

// ===========================
// POST Routes
// ===========================
router.post('/verify-license1', verifyLicense1);

module.exports = router;
