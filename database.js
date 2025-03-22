/**
 * database.js
 * จัดการการเชื่อมต่อกับฐานข้อมูล Supabase
 */
const { createClient } = require('@supabase/supabase-js');
const CONFIG = require('./config');

// สร้างการเชื่อมต่อกับ Supabase
const supabase = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);

/**
 * ทดสอบการเชื่อมต่อกับ Supabase
 * @returns {Promise}
 */
const testConnection = async () => {
  const { data, error } = await supabase.from('auth_sessions').select('count').limit(1);
  if (error) throw error;
  return data;
};

// ... (โค้ดส่วนอื่นคงเดิม)

/**
 * ตรวจสอบจำนวนครั้งที่ผู้ใช้ได้ขอ Ref Code
 * @param {string} userId - LINE user ID
 * @returns {Promise<number>} - จำนวนครั้งที่ขอแล้ว
 */
const getRequestCount = async (userId) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('request_count')  // แก้เป็น request_count
    .eq('line_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 0;
  }
  
  return data.request_count || 0;
};

// ... (โค้ดส่วนที่เหลือคงเดิม)

module.exports = {
  supabase,
  testConnection,
  findSessionByUser,
  findActiveSessionByUser,
  findSessionByRefCode,
  findSessionBySerialKey,
  createSession,
  updateSession,
  getRequestCount,
  getVerifyCount
};
