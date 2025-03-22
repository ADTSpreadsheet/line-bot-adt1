/**
 * middleware/errorHandler.js
 * ตัวจัดการข้อผิดพลาดของแอปพลิเคชัน
 */

/**
 * ตัวจัดการข้อผิดพลาด
 * @param {Error} err - ข้อผิดพลาด
 * @param {Object} req - คำขอ HTTP
 * @param {Object} res - การตอบกลับ HTTP
 * @param {Function} next - ฟังก์ชันถัดไป
 */
const errorHandler = (err, req, res, next) => {
  console.error('Application Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = {
  errorHandler
};
