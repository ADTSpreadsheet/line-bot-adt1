// utils/refCodeGenerator.js

/**
 * สุ่มรหัส Ref.Code ความยาว 4 ตัวอักษร (A-Z + 0-9)
 * เช่น D53B, X9L2
 * @returns {string} refCode
 */
exports.generateRefCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let refCode = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    refCode += characters[randomIndex];
  }
  return refCode;
};

/**
 * สร้างชุดของ Ref.Code จำนวนหลายรหัส
 * @param {number} count - จำนวนรหัสที่ต้องการ
 * @returns {string[]} - อาร์เรย์ของ Ref.Code
 */
exports.generateBulkRefCodes = (count) => {
  const refCodes = [];
  const usedCodes = new Set();
  
  for (let i = 0; i < count; i++) {
    let newCode;
    do {
      newCode = this.generateRefCode();
    } while (usedCodes.has(newCode));
    
    usedCodes.add(newCode);
    refCodes.push(newCode);
  }
  
  return refCodes;
};

/**
 * สร้าง Ref.Code ที่มีนำหน้าด้วยรหัสเฉพาะ (สำหรับแยกประเภทหรือระบบต่างๆ)
 * @param {string} prefix - คำนำหน้าของรหัส (ควรเป็น 1-2 ตัวอักษร)
 * @returns {string} - Ref.Code ที่มีคำนำหน้า
 */
exports.generatePrefixedRefCode = (prefix) => {
  // ตัดให้คำนำหน้าไม่เกิน 2 ตัวอักษร
  const shortPrefix = prefix.substring(0, 2).toUpperCase();
  // สร้างส่วนที่เหลือให้ความยาวรวมเป็น 6 ตัวอักษร (รวมคำนำหน้า)
  const remainingLength = 6 - shortPrefix.length;
  
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let refCode = shortPrefix;
  
  for (let i = 0; i < remainingLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    refCode += characters[randomIndex];
  }
  
  return refCode;
};

/**
 * ตรวจสอบความถูกต้องของรูปแบบ Ref.Code
 * @param {string} refCode - รหัสที่ต้องการตรวจสอบ
 * @returns {boolean} - ผลการตรวจสอบ (true = ถูกต้อง)
 */
exports.validateRefCodeFormat = (refCode) => {
  // ตรวจสอบว่ารหัสมีรูปแบบที่ถูกต้อง (A-Z และ 0-9 ความยาว 4 ตัวอักษร)
  const refCodeRegex = /^[A-Z0-9]{4}$/;
  return refCodeRegex.test(refCode);
};

/**
 * แปลง Ref.Code เป็นรูปแบบที่อ่านง่ายขึ้น (เช่น เพิ่มขีด)
 * @param {string} refCode - Ref.Code
 * @returns {string} - Ref.Code ในรูปแบบที่อ่านง่าย
 */
exports.formatRefCode = (refCode) => {
  // แปลงเป็นรูปแบบ XX-XX
  if (refCode.length === 4) {
    return `${refCode.substring(0, 2)}-${refCode.substring(2, 4)}`;
  }
  return refCode;
};
