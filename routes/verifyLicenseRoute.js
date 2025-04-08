const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const VerifyLicenseController = require('../controllers/VerifyLicenseController');

// ==============================
// 1️⃣ Endpoint สำหรับตรวจสอบ Ref.Code และ Serial Key
// ==============================
router.post('/verify-license1', VerifyLicenseController.verifyLicense1);

// ==============================
// 2️⃣ Endpoint สำหรับตรวจสอบข้อมูลจาก TextBox 4 รายการ
// ==============================
router.post('/verify-license2', VerifyLicenseController.verifyLicense2);

module.exports = router;
