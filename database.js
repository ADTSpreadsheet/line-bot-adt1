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

/**
 * ค้นหา session จาก user ID และสถานะ
 * @param {Object} params - พารามิเตอร์สำหรับการค้นหา
 * @returns {Promise}
 */
const findSessionByUser = async (userId, status = null) => {
  console.log(`Finding session for userId: ${userId}, Status: ${status}`);
  
  let query = supabase
    .from('auth_sessions')
    .select('*')
    .eq('line_user_id', userId);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  console.log('Find Session By User - Data:', data);
  console.log('Find Session By User - Error:', error);
  
  return { data, error };
};

/**
 * ค้นหา session ที่ยังไม่หมดอายุจาก user ID และสถานะ
 * @param {string} userId - LINE user ID
 * @param {string} status - สถานะของ session
 * @returns {Promise}
 */
const findActiveSessionByUser = async (userId, status = 'PENDING') => {
  console.log(`Finding active session - UserId: ${userId}, Status: ${status}`);
  console.log(`Current Time: ${new Date().toISOString()}`);
  
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('line_user_id', userId)
    .eq('status', status)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  console.log('Find Active Session - Data:', data);
  console.log('Find Active Session - Error:', error);
  
  return { data, error };
};

// ... (โค้ดส่วนที่เหลือคงเดิม)
