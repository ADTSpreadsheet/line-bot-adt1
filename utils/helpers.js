// utils/helpers.js - ฟังก์ชันช่วยเหลือทั่วไป

/**
 * สร้าง Ref.Code แบบสุ่ม
 * @returns {string} - Ref.Code ที่สร้างขึ้น (รูปแบบ: LETTER-NUMBER-LETTER-NUMBER, เช่น A1B2)
 */
function generateRefCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let code = '';
  
  // รูปแบบ LETTER-NUMBER-LETTER-NUMBER
  code += letters.charAt(Math.floor(Math.random() * letters.length));
  code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  code += letters.charAt(Math.floor(Math.random() * letters.length));
  code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  
  console.log(`🔑 สร้าง Ref.Code: ${code}`);
  return code;
}

/**
 * สร้าง Serial Key แบบสุ่ม
 * @returns {string} - Serial Key ที่สร้างขึ้น (รูปแบบ: XXXX-XXXX-XXXX-XXXX)
 */
function generateSerialKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  let key = '';
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    key += segment;
    if (i < 3) key += '-';
  }
  
  console.log(`🔑 สร้าง Serial Key: ${key}`);
  return key;
}

/**
 * คำนวณเวลาหมดอายุตามจำนวนนาทีที่กำหนด
 * @param {number} minutes - จำนวนนาทีสำหรับการหมดอายุ
 * @returns {string} - เวลาหมดอายุในรูปแบบ ISO string
 */
function calculateExpiryTime(minutes) {
  const now = new Date();
  const expiry = new Date(now.getTime() + minutes * 60000);
  
  console.log(`⏱️ เวลาหมดอายุ: ${expiry.toISOString()} (${minutes} นาที)`);
  return expiry.toISOString();
}

/**
 * ตรวจสอบว่าเวลาหมดอายุหรือยัง
 * @param {string} expiryTimeISO - เวลาหมดอายุในรูปแบบ ISO string
 * @returns {boolean} - true ถ้าหมดอายุแล้ว, false ถ้ายังไม่หมดอายุ
 */
function isExpired(expiryTimeISO) {
  const now = new Date();
  const expiryTime = new Date(expiryTimeISO);
  
  return now > expiryTime;
}

module.exports = {
  generateRefCode,
  generateSerialKey,
  calculateExpiryTime,
  isExpired
};
