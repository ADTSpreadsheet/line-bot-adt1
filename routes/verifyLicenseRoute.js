const express = require('express');
const router = express.Router();

// ดึงจากหลายไฟล์ได้เลย
const { verifyLicense1, confirmDevice2, submitNationalID } = require('../controllers/verifyLicense1Controller');
const { verifyLicense2, verifyRefCodeAndSerial } = require('../controllers/verifyLicense2Controller');

router.post('/verify-license1', verifyLicense1);
router.post('/confirm-device2', confirmDevice2);
router.post('/submit-national-id', submitNationalID); // ✅ เพิ่ม endpoint สำหรับกรอกเลขบัตรประชาชน
router.post('/verify-license2', verifyLicense2);
router.post('/verifyRefCodeAndSerial', verifyRefCodeAndSerial);

module.exports = router;
