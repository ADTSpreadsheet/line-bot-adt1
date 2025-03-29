// routes/status.js
const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { validateBody, validateQueryParams } = require('../middlewares/validator');
const { supabase } = require('../utils/supabaseClient');

// ✅ ใช้สำหรับสร้างข้อความแสดงเวลานับถอยหลังเป็นภาษาไทย
function formatCountdown(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds Mod % 60;
  return `${minutes} นาที ${seconds} วินาที`;
}

/**
 * @route GET /api/status/check-ref
 * @desc ตรวจสอบว่า Ref.Code มีอยู่หรือไม่ และอยู่ในสถานะใด (GET)
 * @access Public
 */
router.get(
  '/check-ref',
  validateQueryParams(['ref_code']),
  statusController.checkRefCodeStatus
);

/**
 * @route POST /api/status/check-ref
 * @desc ตรวจสอบว่า Ref.Code มีอยู่หรือไม่ และอยู่ในสถานะใด (POST)
 * @access Public
 */
router.post(
  '/check-ref',
  validateBody(['ref_code']),
  statusController.checkRefCodeStatus
);

/**
 * @route POST /api/status/check-machine
 * @desc ตรวจสอบว่า Machine ID เคยลงทะเบียนแล้วหรือไม่
 * @access Public
 */
router.post(
  '/check-machine',
  validateBody(['machine_id']),
  statusController.checkMachineStatus
);

/**
 * @route GET /api/status/check-machine
 * @desc ตรวจสอบว่า Machine ID เคยลงทะเบียนแล้วหรือไม่ (GET)
 * @access Public
 */
router.get(
  '/check-machine',
  validateQueryParams(['machine_id']),
  statusController.checkMachineStatus
);

/**
 * @route POST /api/status/check-license
 * @desc ตรวจสอบสถานะ License ของผู้ใช้ (PENDING, ACTIVE, BLOCKED)
 * @access Public
 */
router.post(
  '/check-license',
  validateBody(['ref_code']),
  statusController.checkLicenseStatus
);

/**
 * @route GET /api/status/check-trial
 * @desc ตรวจสอบระยะเวลาทดลองใช้ที่เหลือ
 * @access Public
 */
router.get(
  '/check-trial',
  validateQueryParams(['machine_id']),
  statusController.checkTrialPeriod
);

/**
 * @route POST /api/status/check-trial
 * @desc ตรวจสอบระยะเวลาทดลองใช้ที่เหลือ
 * @access Public
 */
router.post(
  '/check-trial',
  validateBody(['machine_id']),
  statusController.checkTrialPeriod
);

/**
 * @route POST /api/status/extend-trial
 * @desc ขยายระยะเวลาทดลองใช้
 * @access Protected - ต้องมีการยืนยันตัวตน
 */
router.post(
  '/extend-trial',
  validateBody(['ref_code', 'machine_id']),
  statusController.extendTrialPeriod
);

/**
 * @route POST /api/status/start-countdown
 * @desc เริ่มนับถอยหลัง 5 นาที เมื่อผู้ใช้กด Verify Code
 * @access Public
 */
router.post('/start-countdown', async (req, res) => {
  const { ref_code } = req.body;

  if (!ref_code) {
    return res.status(400).json({ success: false, message: 'Ref.Code ไม่ถูกต้อง' });
  }

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60000).toISOString();

    const { data, error } = await supabase
      .from('auth_sessions')
      .update({ expires_at: expiresAt })
      .eq('ref_code', ref_code)
      .is('expires_at', null)
      .eq('status', 'ACTIVE');

    if (error) {
      console.error('❌ Supabase error:', error.message);
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตั้งเวลา' });
    }

    const message = `⏳ รหัส Serial Key ของคุณจะหมดเวลาภายใน ${formatCountdown(5 * 60000)}`;
    return res.status(200).json({ success: true, message });
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

module.exports = router;
