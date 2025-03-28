// utils/logger.js
const chalk = require('chalk');

// ระดับของ log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// ตั้งค่าระดับ log จาก environment variable หรือค่าเริ่มต้น
const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

/**
 * แสดงข้อความดีบัก (DEBUG)
 * @param  {...any} args - ข้อความที่ต้องการแสดง
 */
const debug = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    console.log(chalk.blue('[DEBUG]'), ...args);
  }
};

/**
 * แสดงข้อความข้อมูลปกติ (INFO)
 * @param  {...any} args - ข้อความที่ต้องการแสดง
 */
const info = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.log(chalk.cyan('[INFO]'), ...args);
  }
};

/**
 * แสดงข้อความเตือน (WARNING)
 * @param  {...any} args - ข้อความที่ต้องการแสดง
 */
const warn = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    console.warn(chalk.yellow('[WARN]'), ...args);
  }
};

/**
 * แสดงข้อความผิดพลาด (ERROR)
 * @param  {...any} args - ข้อความที่ต้องการแสดง
 */
const error = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    console.error(chalk.red('[ERROR]'), ...args);
  }
};

/**
 * แสดงข้อความสำเร็จ (SUCCESS)
 * @param  {...any} args - ข้อความที่ต้องการแสดง
 */
const success = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.log(chalk.green('[SUCCESS]'), ...args);
  }
};

/**
 * สร้าง log ที่มีการระบุโมดูล
 * @param {string} moduleName - ชื่อโมดูล
 * @returns {Object} - Object ที่มีฟังก์ชัน log สำหรับโมดูลนั้น
 */
const createModuleLogger = (moduleName) => {
  return {
    debug: (...args) => debug(`[${moduleName}]`, ...args),
    info: (...args) => info(`[${moduleName}]`, ...args),
    warn: (...args) => warn(`[${moduleName}]`, ...args),
    error: (...args) => error(`[${moduleName}]`, ...args),
    success: (...args) => success(`[${moduleName}]`, ...args)
  };
};

/**
 * บันทึก log ลงในไฟล์ (ถ้าต้องการเพิ่มในอนาคต)
 * @param {string} level - ระดับของ log
 * @param {string} message - ข้อความ
 */
const logToFile = (level, message) => {
  // ในอนาคตอาจเพิ่มการบันทึกลงไฟล์ได้ที่นี่
  // เช่น ใช้ winston หรือ other logging libraries
};

/**
 * แสดงเวลาปัจจุบัน สำหรับเพิ่มใน log
 * @returns {string} - เวลาปัจจุบันในรูปแบบ ISO
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

module.exports = {
  debug,
  info,
  warn,
  error,
  success,
  createModuleLogger,
  LOG_LEVELS
};
