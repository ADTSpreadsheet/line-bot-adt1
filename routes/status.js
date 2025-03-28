// routes/status.js
const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { validateBody, validateQueryParams } = require('../middlewares/validator');

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

module.exports = router;
