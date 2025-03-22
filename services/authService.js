/**
 * services/authService.js
 * บริการที่เกี่ยวข้องกับการยืนยันตัวตน (Ref.Code + Serial Key)
 */

const db = require('../database');
const {
  generateRefCode,
  generateSerialKey,
  calculateExpiryTime
} = require('../utils/helpers');
const CONFIG = require('../config');

/**
 * ตรวจสอบว่าผู้ใช้มี Ref Code ที่ยังไม่หมดอายุหรือไม่
 */
const checkActiveRefCode = async (userId) => {
  try {
    const { data, error } = await db.findActiveSessionByUser(userId, 'PENDING');

    if (error) {
      console.error('Error checking active ref code:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception checking active ref code:', error);
    return null;
  }
};

/**
 * ตรวจสอบว่าผู้ใช้เคยลงทะเบียนสำเร็จแล้วหรือไม่
 */
const checkVerifiedSession = async (userId) => {
  try {
    const { data, error } = await db.findActiveSessionByUser(userId, 'VERIFIED');

    if (error) {
      console.error('Error checking verified session:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Exception checking verified session:', error);
    return false;
  }
};

/**
 * สร้าง Ref Code + Serial Key พร้อมกันทันที
 */
const createNewRefCode = async (userId) => {
  try {
    const currentCount = await db.getRequestCount(userId);

    if (currentCount >= CONFIG.AUTH.MAX_REQUEST_COUNT) {
      return {
        success: false,
        message: `คุณได้ขอรหัสครบ ${CONFIG.AUTH.MAX_REQUEST_COUNT} ครั้งแล้ว ไม่สามารถขอเพิ่มได้อีก`
      };
    }

    const refCode = generateRefCode();
    const serialKey = generateSerialKey();
    const now = new Date();
    const expiresAt = calculateExpiryTime(CONFIG.AUTH.REF_CODE_EXPIRY_MINUTES);

    const sessionData = {
      line_user_id: userId,
      ref_code: refCode,
      serial_key: serialKey,
      status: 'PENDING',
      request_count: currentCount + 1,
      verify_count: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt
    };

    const { data, error } = await db.createSession(sessionData);

    if (error) {
      console.error('Error creating ref code:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างรหัสอ้างอิง กรุณาลองใหม่อีกครั้ง'
      };
    }

    return {
      success: true,
      refCode,
      serialKey,
      expiresAt,
      sessionData: data[0]
    };
  } catch (error) {
    console.error('Exception creating ref code:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรหัสอ้างอิง กรุณาลองใหม่อีกครั้ง'
    };
  }
};

module.exports = {
  checkActiveRefCode,
  checkVerifiedSession,
  createNewRefCode
};
