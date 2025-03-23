// config.js - การตั้งค่าสำหรับ Webhook2

// ข้อมูลการเชื่อมต่อ Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpxpukbvynxawfxcdroj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweHB1a2J2eW54YXdmeGNkcm9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjM4Njc5MiwiZXhwIjoyMDU3OTYyNzkyfQ.tgeHy_TMIx6UuQLBXDiKYTi8QyeO7fMI7ZSRuEBiUKM';

// ข้อมูลการเชื่อมต่อ LINE API สำหรับ Bot 2
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN_BOT2 || 'VcdMebbh7xEnFBj3t58u/vjAOfjBbrelQs0pLGPTUmvrc3wHYjyWhAA98hy/SkWE1Tj4HjRxMzQu0V9eFYXH78QVYfxLftp6uqyzZsLACPZMbXIkjxqyqJPVYbcg507U3TwgUjZh+Y/7zpy/IzmZpQdB04t89/1O/w1cDnyilFU=';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET_BOT2 || '3558642df20f8e7e357c70c5ffd826f4';

// User ID ของ Admin ที่จะรับข้อความแจ้งเตือนการลงทะเบียนใหม่
const ADMIN_LINE_USER_ID = process.env.ADMIN_LINE_USER_ID || 'Ub7406c5f05771fb36c32c1b1397539f6';

// ชื่อตาราง Supabase
const REGISTRATIONS_TABLE = 'user_registrations';

// ข้อความแจ้งเตือนเมื่อมีการลงทะเบียนใหม่
const NEW_REGISTRATION_MESSAGE = 'ลงทะเบียนสำเร็จรายใหม่';

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  ADMIN_LINE_USER_ID,
  REGISTRATIONS_TABLE,
  NEW_REGISTRATION_MESSAGE
};
