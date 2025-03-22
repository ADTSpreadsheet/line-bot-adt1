/**
 * config.js
 * ไฟล์สำหรับการตั้งค่าต่างๆ ในแอปพลิเคชัน
 */

require('dotenv').config();

const CONFIG = {
  LINE: {
    BOT1: {
      ID: process.env.LINE_BOT1_ID || '',
      ACCESS_TOKEN: process.env.LINE_BOT1_ACCESS_TOKEN || '',
      CHANNEL_SECRET: process.env.LINE_BOT1_CHANNEL_SECRET || ''
    },
    BOT2: {
      ID: process.env.LINE_BOT2_ID || '',
      ACCESS_TOKEN: process.env.LINE_BOT2_ACCESS_TOKEN || '',
      CHANNEL_SECRET: process.env.LINE_BOT2_CHANNEL_SECRET || ''
    },
    BOT3: {
      ID: process.env.LINE_BOT3_ID || '',
      ACCESS_TOKEN: process.env.LINE_BOT3_ACCESS_TOKEN || '',
      CHANNEL_SECRET: process.env.LINE_BOT3_CHANNEL_SECRET || ''
    },
    ADMIN_USER_ID: process.env.ADMIN_USER_ID || ''
  },
  SUPABASE: {
    URL: process.env.SUPABASE_URL || '',
    KEY: process.env.SUPABASE_KEY || ''
  },
  SERVER: {
    PORT: process.env.PORT || 10000,
    URL: process.env.SERVER_URL || 'http://localhost:10000'
  },
  AUTH: {
    REF_CODE_EXPIRY_MINUTES: 15,        // Ref Code หมดอายุหลังจาก 15 นาที
    SERIAL_KEY_EXPIRY_MINUTES: 30,      // Serial Key หมดอายุหลังจาก 30 นาที
    MAX_REQUEST_COUNT: 3,               // ขอ Ref Code ได้ไม่เกิน 3 ครั้ง
    MAX_VERIFY_COUNT: 3                 // กดปุ่ม Verify ได้ไม่เกิน 3 ครั้ง
  }
};

module.exports = CONFIG;
