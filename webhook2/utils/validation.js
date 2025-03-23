// validation.js - ฟังก์ชันสำหรับตรวจสอบความถูกต้องของข้อมูล

/**
 * ตรวจสอบความถูกต้องของข้อมูลการลงทะเบียน
 * @param {Object} data - ข้อมูลการลงทะเบียนที่ต้องการตรวจสอบ
 * @returns {Object} ผลการตรวจสอบ {isValid: boolean, errors: Array}
 */
function validateRegistrationData(data) {
  const errors = [];

  // ตรวจสอบว่ามีข้อมูลหรือไม่
  if (!data) {
    errors.push('ไม่พบข้อมูลการลงทะเบียน');
    return { isValid: false, errors };
  }

  // ตรวจสอบชื่อ
  if (!data.name || data.name.trim() === '') {
    errors.push('กรุณาระบุชื่อ');
  }

  // ตรวจสอบนามสกุล
  if (!data.lastName || data.lastName.trim() === '') {
    errors.push('กรุณาระบุนามสกุล');
  }

  // ตรวจสอบอีเมล
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('กรุณาระบุอีเมลให้ถูกต้อง');
  }

  // ตรวจสอบเบอร์โทรศัพท์
  if (!data.phone || !isValidPhone(data.phone)) {
    errors.push('กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง');
  }

  // ตรวจสอบเลขบัตรประชาชน
  if (!data.nationalId || !isValidNationalId(data.nationalId)) {
    errors.push('กรุณาระบุเลขบัตรประชาชนให้ถูกต้อง');
  }

  // ตรวจสอบที่อยู่
  if (!data.houseNumber || data.houseNumber.trim() === '') {
    errors.push('กรุณาระบุเลขที่บ้าน');
  }

  if (!data.district || data.district.trim() === '') {
    errors.push('กรุณาระบุอำเภอ');
  }

  if (!data.province || data.province.trim() === '') {
    errors.push('กรุณาระบุจังหวัด');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ตรวจสอบรูปแบบอีเมล
 * @param {string} email - อีเมลที่ต้องการตรวจสอบ
 * @returns {boolean} ผลการตรวจสอบ
 */
function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * ตรวจสอบรูปแบบเบอร์โทรศัพท์
 * @param {string} phone - เบอร์โทรศัพท์ที่ต้องการตรวจสอบ
 * @returns {boolean} ผลการตรวจสอบ
 */
function isValidPhone(phone) {
  // รับรูปแบบเบอร์โทรไทย เช่น 0891234567, 089-123-4567, +66891234567
  const re = /^(\+66|0)[0-9]{8,9}$|^(\+66|0)[0-9]{2}[-\s]?[0-9]{3}[-\s]?[0-9]{4}$/;
  return re.test(String(phone).replace(/\s+/g, ''));
}

/**
 * ตรวจสอบรูปแบบเลขบัตรประชาชน
 * @param {string} id - เลขบัตรประชาชนที่ต้องการตรวจสอบ
 * @returns {boolean} ผลการตรวจสอบ
 */
function isValidNationalId(id) {
  // ตรวจสอบว่าเป็นตัวเลข 13 หลัก
  if (!/^\d{13}$/.test(id)) return false;

  // ตรวจสอบเลขบัตรประชาชนตามสูตร
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseFloat(id.charAt(i)) * (13 - i);
  }
  const mod = (11 - (sum % 11)) % 10;
  return mod === parseFloat(id.charAt(12));
}

/**
 * ทำความสะอาดและนอร์มอลไลซ์ข้อมูล
 * @param {Object} data - ข้อมูลที่ต้องการทำความสะอาด
 * @returns {Object} ข้อมูลที่ผ่านการทำความสะอาดแล้ว
 */
function sanitizeData(data) {
  const sanitized = { ...data };
  
  // ทำความสะอาดชื่อและนามสกุล
  if (sanitized.name) sanitized.name = sanitized.name.trim();
  if (sanitized.lastName) sanitized.lastName = sanitized.lastName.trim();
  
  // ทำความสะอาดอีเมล
  if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
  
  // ทำความสะอาดเบอร์โทร (ลบอักขระพิเศษ)
  if (sanitized.phone) sanitized.phone = sanitized.phone.replace(/[^\d+]/g, '');
  
  // ทำความสะอาดที่อยู่
  if (sanitized.houseNumber) sanitized.houseNumber = sanitized.houseNumber.trim();
  if (sanitized.district) sanitized.district = sanitized.district.trim();
  if (sanitized.province) sanitized.province = sanitized.province.trim();
  
  // ทำความสะอาดเลขบัตรประชาชน (ลบขีดคั่น)
  if (sanitized.nationalId) sanitized.nationalId = sanitized.nationalId.replace(/-/g, '');
  
  return sanitized;
}

module.exports = {
  validateRegistrationData,
  sanitizeData,
  isValidEmail,
  isValidPhone,
  isValidNationalId
};
