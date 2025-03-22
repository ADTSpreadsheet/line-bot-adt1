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
 * สำหรับคอลัมน์ประเภท timetz ในฐานข้อมูล
 * @param {number} minutes - จำนวนนาทีสำหรับการหมดอายุ
 * @returns {string} - เวลาหมดอายุในรูปแบบ HH:MM:SS+07
 */
function calculateExpiryTime(minutes) {
  const now = new Date();
  const expiry = new Date(now.getTime() + minutes * 60000);
  
  // สร้างเวลาในรูปแบบ HH:MM:SS+07 สำหรับประเภทข้อมูล timetz
  // เนื่องจากเราใช้ Time Zone เป็น Asia/Bangkok (+07)
  const timeOnly = expiry.toTimeString().split(' ')[0] + '+07';
  
  console.log(`⏱️ เวลาหมดอายุ: ${timeOnly} (${minutes} นาที)`);
  return timeOnly;
}

/**
 * ตรวจสอบว่าเวลาหมดอายุหรือยัง สำหรับประเภทข้อมูล timetz
 * @param {string} expiryTime - เวลาหมดอายุในรูปแบบ HH:MM:SS+07
 * @param {string} currentTime - เวลาปัจจุบันในรูปแบบ HH:MM:SS+07
 * @returns {boolean} - true ถ้าหมดอายุแล้ว, false ถ้ายังไม่หมดอายุ
 */
function isExpired(expiryTime, currentTime) {
  // แปลงเวลาเป็นนาที เพื่อเปรียบเทียบ
  function timeToMinutes(timeStr) {
    const timePart = timeStr.split('+')[0]; // ตัด timezone ออก
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  const expiryMinutes = timeToMinutes(expiryTime);
  const currentMinutes = timeToMinutes(currentTime);
  
  // ถ้าเวลาหมดอายุน้อยกว่าเวลาปัจจุบัน และไม่ได้ข้ามวัน
  if (expiryMinutes < currentMinutes) {
    return true;
  }
  
  // ถ้าเวลาหมดอายุมากกว่าเวลาปัจจุบันมาก (เช่น 23:00 vs 01:00) อาจหมายถึงข้ามวัน
  if (expiryMinutes > currentMinutes + 22 * 60) {
    return true;
  }
  
  return false;
}

module.exports = {
  generateRefCode,
  generateSerialKey,
  calculateExpiryTime,
  isExpired
};
