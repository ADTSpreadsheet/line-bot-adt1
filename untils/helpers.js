/**
 * utils/helpers.js
 * ฟังก์ชันช่วยเหลือต่างๆ
 */

const crypto = require('crypto');

/**
 * สร้างรหัสอ้างอิง 4 หลัก
 * @returns {string} - รหัสอ้างอิง 4 หลัก
 */
const generateRefCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * สร้าง Serial Key ในรูปแบบ XXXX-XX
 * @returns {string} - Serial Key ในรูปแบบ XXXX-XX
 */
const generateSerialKey = () => {
  const serialNumber = Math.floor(1000 + Math.random() * 9000).toString();
  const serialChars = Math.random().toString(36).substring(2, 4).toUpperCase();
  return serialNumber + "-" + serialChars;
};

/**
 * คำนวณเวลาหมดอายุ
 * @param {number} minutes - จำนวนนาทีที่จะหมดอายุ
 * @returns {string} - เวลาหมดอายุในรูปแบบ ISO
 */
const calculateExpiryTime = (minutes) => {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + minutes);
  return expirationTime.toISOString();
};

/**
 * ตรวจสอบลายเซ็นของ LINE
 * @param {Object} body - ข้อมูลที่ส่งมาจาก LINE
 * @param {string} signature - ลายเซ็นที่ส่งมาจาก LINE
 * @param {string} channelSecret - Channel Secret ของ LINE Bot
 * @returns {boolean} - ผลการตรวจสอบ
 */
const validateLineSignature = (body, signature, channelSecret) => {
  try {
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(Buffer.from(JSON.stringify(body)))
      .digest('base64');
    
    return hash === signature;
  } catch (error) {
    console.error('Signature Validation Error:', error);
    return false;
  }
};

module.exports = {
  generateRefCode,
  generateSerialKey,
  calculateExpiryTime,
  validateLineSignature
};
