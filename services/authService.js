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
 * สร้าง Ref Code ใหม่
 * @param {string} userId - LINE user ID
 * @returns {Promise<Object>} - ข้อมูลของ Ref Code ที่สร้าง
 */
const createNewRefCode = async (userId) => {
  try {
    // ตรวจสอบว่าผู้ใช้ได้ขอ Ref Code ไปแล้วกี่ครั้ง
    const currentCount = await db.getRequestCount(userId);
    
    // ถ้าเกินจำนวนที่กำหนด ให้ return null
    if (currentCount >= CONFIG.AUTH.MAX_REQUEST_COUNT) {
      return { 
        success: false, 
        message: `คุณได้ขอรหัสครบ ${CONFIG.AUTH.MAX_REQUEST_COUNT} ครั้งแล้ว ไม่สามารถขอเพิ่มได้อีก` 
      };
    }
    
    const refCode = generateRefCode();
    const expiresAt = calculateExpiryTime(CONFIG.AUTH.REF_CODE_EXPIRY_MINUTES);
    
    const sessionData = {
      line_user_id: userId,
      ref_code: refCode,
      status: 'PENDING',
      request_count: currentCount + 1,
      verify_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

/**
 * ตรวจสอบ Ref Code และสร้าง Serial Key
 * @param {string} refCode - รหัสอ้างอิง
 * @returns {Promise<Object>} - ผลการตรวจสอบและข้อมูล Serial Key
 */
const verifyRefCodeAndGenerateSerialKey = async (refCode) => {
  try {
    // ค้นหา session จาก Ref Code
    const { data: session, error } = await db.findSessionByRefCode(refCode);
    
    if (error || !session) {
      return { 
        success: false, 
        message: 'รหัสอ้างอิงไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่' 
      };
    }
    
    // ตรวจสอบจำนวนครั้งที่กดปุ่ม Verify
    if (session.verify_count >= CONFIG.AUTH.MAX_VERIFY_COUNT) {
      return { 
        success: false, 
        message: `คุณได้กดปุ่มยืนยันครบ ${CONFIG.AUTH.MAX_VERIFY_COUNT} ครั้งแล้ว ไม่สามารถยืนยันได้อีก` 
      };
    }
    
    // สร้าง Serial Key
    const serialKey = generateSerialKey();
    const expiresAt = calculateExpiryTime(CONFIG.AUTH.SERIAL_KEY_EXPIRY_MINUTES);
    
    // อัปเดต session
    const updateData = {
      serial_key: serialKey,
      status: 'AWAITING_VERIFICATION',
      verify_count: (session.verify_count || 0) + 1,
      verify_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt
    };
    
    const { data: updatedSession, error: updateError } = await db.updateSession(session.id, updateData);
    
    if (updateError) {
      console.error('Error updating session with serial key:', updateError);
      return { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการสร้าง Serial Key กรุณาลองใหม่อีกครั้ง' 
      };
    }
    
    return { 
      success: true, 
      serialKey, 
      expiresAt,
      userId: session.line_user_id,
      sessionData: updatedSession[0]
    };
  } catch (error) {
    console.error('Exception verifying ref code:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสอ้างอิง กรุณาลองใหม่อีกครั้ง' 
    };
  }
};

/**
 * ยืนยัน Serial Key
 * @param {string} serialKey - Serial Key
 * @returns {Promise<Object>} - ผลการยืนยัน
 */
const verifySerialKey = async (serialKey) => {
  try {
    // ค้นหา session จาก Serial Key
    const { data: session, error } = await db.findSessionBySerialKey(serialKey);
    
    if (error || !session) {
      return { 
        success: false, 
        message: 'Serial Key ไม่ถูกต้องหรือหมดอายุแล้ว' 
      };
    }
    
    // อัปเดตสถานะเป็น SUCCESS
    const updateData = {
      status: 'SUCCESS',
      updated_at: new Date().toISOString()
    };
    
    const { data: updatedSession, error: updateError } = await db.updateSession(session.id, updateData);
    
    if (updateError) {
      console.error('Error updating session status:', updateError);
      return { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการยืนยัน Serial Key กรุณาลองใหม่อีกครั้ง' 
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
      message: 'เกิดข้อผิดพลาดในการยืนยัน Serial Key กรุณาลองใหม่อีกครั้ง' 
    };
  }
};

module.exports = {
  checkActiveRefCode,
  createNewRefCode,
  verifyRefCodeAndGenerateSerialKey,
  verifySerialKey
};
