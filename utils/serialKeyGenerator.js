// utils/serialKeyGenerator.js

/**
 * สร้าง Serial Key ความยาว 6 ตัว (ตัวเลข 4 + ตัวอักษร 2)
 * เช่น 1234AB, 8790XZ
 * @returns {string} - Serial Key
 */
exports.generateSerialKey = () => {
  const digits = '0123456789';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let numberPart = '';
  let letterPart = '';
  
  // สุ่มเลข 4 หลัก
  for (let i = 0; i < 4; i++) {
    const randomDigit = digits[Math.floor(Math.random() * digits.length)];
    numberPart += randomDigit;
  }
  
  // สุ่มตัวอักษร 2 ตัว
  for (let i = 0; i < 2; i++) {
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    letterPart += randomLetter;
  }
  
  return numberPart + letterPart;
};

/**
 * ตรวจสอบรูปแบบ Serial Key ว่าถูกต้องหรือไม่
 * @param {string} serialKey - Serial Key ที่ต้องการตรวจสอบ
 * @returns {boolean} - ผลการตรวจสอบ (true = ถูกต้อง)
 */
exports.validateSerialKeyFormat = (serialKey) => {
  const serialRegex = /^[0-9]{4}[A-Z]{2}$/;
  return serialRegex.test(serialKey);
};

/**
 * สร้าง Serial Key แบบมีจำนวนมาก พร้อมหลีกเลี่ยงการซ้ำซ้อน
 * @param {number} count - จำนวน Serial Key ที่ต้องการสร้าง
 * @returns {string[]} - อาร์เรย์ของ Serial Key
 */
exports.generateBulkSerialKeys = (count) => {
  const keys = [];
  const usedKeys = new Set();
  
  while (keys.length < count) {
    const newKey = this.generateSerialKey();
    
    if (!usedKeys.has(newKey)) {
      usedKeys.add(newKey);
      keys.push(newKey);
    }
  }
  
  return keys;
};

/**
 * แปลงรูปแบบ Serial Key ให้อ่านง่ายขึ้น
 * @param {string} serialKey - Serial Key ดั้งเดิม
 * @returns {string} - Serial Key ในรูปแบบที่อ่านง่าย
 */
exports.formatSerialKey = (serialKey) => {
  if (serialKey.length !== 6) {
    return serialKey;
  }
  
  // แปลงเป็นรูปแบบ XXXX-XX
  return `${serialKey.substring(0, 4)}-${serialKey.substring(4, 6)}`;
};

/**
 * สร้าง Serial Key ในรูปแบบที่กำหนดเอง
 * @param {Object} options - ตัวเลือกการสร้าง
 * @param {number} options.digitCount - จำนวนตัวเลข (ค่าเริ่มต้น: 4)
 * @param {number} options.letterCount - จำนวนตัวอักษร (ค่าเริ่มต้น: 2)
 * @param {boolean} options.includeSpecial - รวมอักขระพิเศษหรือไม่
 * @returns {string} - Serial Key ที่สร้างขึ้น
 */
exports.generateCustomSerialKey = (options = {}) => {
  const {
    digitCount = 4,
    letterCount = 2,
    includeSpecial = false
  } = options;
  
  const digits = '0123456789';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const specialChars = '#$%&@';
  
  let serialKey = '';
  
  // สร้างส่วนตัวเลข
  for (let i = 0; i < digitCount; i++) {
    const randomDigit = digits[Math.floor(Math.random() * digits.length)];
    serialKey += randomDigit;
  }
  
  // สร้างส่วนตัวอักษร
  for (let i = 0; i < letterCount; i++) {
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    serialKey += randomLetter;
  }
  
  // เพิ่มอักขระพิเศษถ้าต้องการ
  if (includeSpecial) {
    const randomSpecial = specialChars[Math.floor(Math.random() * specialChars.length)];
    serialKey += randomSpecial;
  }
  
  // สลับตำแหน่งอักขระเพื่อให้มีความสุ่มมากขึ้น
  return serialKey.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * เข้ารหัส Serial Key เพื่อป้องกันการสร้างขึ้นเอง
 * @param {string} serialKey - Serial Key ดั้งเดิม
 * @param {string} salt - ค่า salt สำหรับการเข้ารหัส
 * @returns {string} - Serial Key ที่เข้ารหัสแล้ว
 */
exports.encodeSerialKey = (serialKey, salt = 'ADT') => {
  // ใช้วิธีการง่ายๆ เพื่อเข้ารหัส
  const encoded = serialKey.split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code + salt.length);
    })
    .join('');
  
  return Buffer.from(encoded).toString('base64');
};

/**
 * ถอดรหัส Serial Key
 * @param {string} encodedKey - Serial Key ที่เข้ารหัสแล้ว
 * @param {string} salt - ค่า salt ที่ใช้ในการเข้ารหัส
 * @returns {string} - Serial Key ดั้งเดิม
 */
exports.decodeSerialKey = (encodedKey, salt = 'ADT') => {
  try {
    const decoded = Buffer.from(encodedKey, 'base64').toString();
    
    return decoded.split('')
      .map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(code - salt.length);
      })
      .join('');
  } catch (error) {
    console.error('❌ Error decoding serial key:', error);
    return null;
  }
};
