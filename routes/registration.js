// routes/registration.js
const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { validateBody } = require('../middlewares/validator');

/**
 * @route POST /api/registration/create-ref
 * @desc สร้าง Ref.Code ใหม่และส่งไปยัง LINE
 * @access Public
 */
router.post(
  '/create-ref', 
  validateBody(['line_user_id']), // ตรวจสอบว่ามี line_user_id ในข้อมูลที่ส่งมา
  registrationController.createRefCode
);

/**
 * @route POST /api/registration/verify-serial
 * @desc ตรวจสอบ Serial Key กับ Ref.Code
 * @access Public
 */
router.post(
  '/verify-serial',
  validateBody(['ref_code', 'serial_key']), // ตรวจสอบว่ามีข้อมูลที่จำเป็น
  registrationController.verifySerialKey
);

/**
 * @route POST /api/registration/complete-registration
 * @desc บันทึกข้อมูลผู้ใช้งานจาก Excel VBA
 * @access Public
 */
router.post(
  '/complete-registration',
  validateBody(['ref_code', 'machine_id', 'user_data']), // ตรวจสอบข้อมูลที่จำเป็น
  registrationController.completeRegistration
);

/**
 * @route POST /api/registration/resend-serial
 * @desc ส่ง Serial Key อีกครั้งเมื่อผู้ใช้ต้องการ
 * @access Public
 */
router.post(
  '/resend-serial',
  validateBody(['ref_code']),
  registrationController.resendSerialKey
);

module.exports = router;
