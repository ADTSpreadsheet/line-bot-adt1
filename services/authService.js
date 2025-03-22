/**
 * services/authService.js
 * บริการที่เกี่ยวข้องกับการยืนยันตัวตน
 */

const db = require('../database');
const { generateRefCode, generateSerialKey, calculateExpiryTime } = require('../utils/helpers');
const CONFIG = require('../config');

/**
 * ตรวจสอบว่าผู้ใช้มี Ref Code ที่ยังไม่หมดอายุหรือไม่
 * @param {string} userId - LINE user ID
 * @returns {Promise<Object>} - ข้อมูล session ที่พบ หรือ null
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
 * สร้าง Ref Code + Serial Key พร้อมกัน
 * @param {string} userId - LINE user ID
 * @returns {Promise<Object>} - ผลลัพธ์การสร้าง session
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
    const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000); // เวลาไทย
    const expiresAt = new Date(thaiNow.getTime() + CONFIG.AUTH.REF_CODE_EXPIRY_MINUTES * 60000);

    const sessionData = {
      line_user_id: userId,
      ref_code: refCode,
      serial_key: serialKey,
      day_created_at: thaiNow.toISOString().split('T')[0], // YYYY-MM-DD
      time_created_at: thaiNow.toISOString().split('T')[1], // HH:mm:ss.sssZ
      request_count: currentCount + 1,
      verify_count: 0,
      status: 'PENDING',
      updated_at: thaiNow.toISOString(),
      expires_at: expiresAt.toISOString()
    };

    const { data, error } = await db.createSession(sessionData);

    if (error) {
      console.error('Error creating session:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่อีกครั้ง'
      };
    }

    return {
      success: true,
      refCode,
      serialKey,
      sessionData: data[0]
    };
  } catch (error) {
    console.error('Exception creating ref code:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่อีกครั้ง'
    };
  }
};

/**
 * ยืนยัน Serial Key
 * @param {string} serialKey - Serial Key ที่ผู้ใช้กรอกจาก Excel VBA
 * @returns {Promise<Object>} - ผลการยืนยัน
 */
const verifySerialKey = async (serialKey) => {
  try {
    const { data: session, error } = await db.findSessionBySerialKey(serialKey);

    if (error || !session) {
      return {
        success: false,
        message: 'Serial Key ไม่ถูกต้องหรือหมดอายุแล้ว'
      };
    }

    const updateData = {
      status: 'SUCCESS',
      updated_at: new Date().toISOString()
    };

    const { data: updatedSession, error: updateError } = await db.updateSession(session.id, updateData);

    if (updateError) {
      console.error('Error updating session status:', updateError);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการยืนยัน กรุณาลองใหม่'
      };
    }

    return {
      success: true,
      message: 'ยืนยัน Serial Key สำเร็จ',
      userId: session.line_user_id,
      sessionData: updatedSession[0]
    };
  } catch (error) {
    console.error('Exception verifying serial key:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการยืนยัน กรุณาลองใหม่'
    };
  }
};

module.exports = {
  checkActiveRefCode,
  createNewRefCode,
  verifySerialKey
};
