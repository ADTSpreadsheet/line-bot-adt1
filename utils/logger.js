// utils/logger.js
// const chalk = require('chalk'); // ปิดการใช้งาน chalk

// ระดับของ log
// utils/logger.js

// ระดับของ log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// กำหนดระดับ log จาก ENV หรือใช้ค่า default
const currentLogLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

const getTimestamp = () => {
  return new Date().toISOString();
};

// ฟังก์ชันกลางสำหรับแสดง log แบบมี timestamp
const logWithLevel = (levelTag, moduleName, ...args) => {
  const prefix = `[${levelTag}]${moduleName ? ` [${moduleName}]` : ''} ${getTimestamp()}`;
  console.log(prefix, ...args);
};

// ฟังก์ชันสำหรับ log แต่ละระดับ
const debug = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) logWithLevel('DEBUG', null, ...args);
};

const info = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) logWithLevel('INFO', null, ...args);
};

const warn = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.WARN) logWithLevel('WARN', null, ...args);
};

const error = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.ERROR) logWithLevel('ERROR', null, ...args);
};

const success = (...args) => {
  if (currentLogLevel <= LOG_LEVELS.INFO) logWithLevel('SUCCESS', null, ...args);
};

// สำหรับสร้าง logger ของแต่ละโมดูล
const createModuleLogger = (moduleName) => {
  return {
    debug: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.DEBUG) logWithLevel('DEBUG', moduleName, ...args);
    },
    info: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) logWithLevel('INFO', moduleName, ...args);
    },
    warn: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.WARN) logWithLevel('WARN', moduleName, ...args);
    },
    error: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.ERROR) logWithLevel('ERROR', moduleName, ...args);
    },
    success: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) logWithLevel('SUCCESS', moduleName, ...args);
    }
  };
};

// Placeholder สำหรับ log ลงไฟล์ในอนาคต
const logToFile = (level, message) => {
  // ยังไม่ implement
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

