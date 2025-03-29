// utils/logger.js
// const chalk = require('chalk'); // ปิดการใช้งาน chalk

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

const debug = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

const info = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.log('[INFO]', ...args);
  }
};

const warn = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    console.warn('[WARN]', ...args);
  }
};

const error = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    console.error('[ERROR]', ...args);
  }
};

const success = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.log('[SUCCESS]', ...args);
  }
};

const createModuleLogger = (moduleName) => {
  return {
    debug: (...args) => debug(`[${moduleName}]`, ...args),
    info: (...args) => info(`[${moduleName}]`, ...args),
    warn: (...args) => warn(`[${moduleName}]`, ...args),
    error: (...args) => error(`[${moduleName}]`, ...args),
    success: (...args) => success(`[${moduleName}]`, ...args)
  };
};

const logToFile = (level, message) => {
  // ในอนาคตอาจเพิ่มการบันทึกลงไฟล์ได้ที่นี่
};

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
