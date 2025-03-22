// database.js - ไฟล์สำหรับการเชื่อมต่อกับ Supabase

const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL หรือ SUPABASE_KEY ไม่ถูกกำหนด');
  process.exit(1);
}

console.log('🔌 เชื่อมต่อกับ Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// ชื่อตาราง
const SESSIONS_TABLE = 'auth_sessions';

/**
 * ค้นหา session ที่ยังใช้งานได้ของผู้ใช้
 * @param {string} lineUserId - ID ของผู้ใช้ LINE
 * @param {string} status - สถานะของ session (PENDING, VERIFIED, EXPIRED)
 * @returns {Promise<Object|null>} - ข้อมูล session หรือ null ถ้าไม่พบ
 */
async function findActiveSessionByUser(lineUserId, status = 'PENDING') {
  console.log(`🔍 ค้นหา session ที่ยังใช้งานได้สำหรับ userId: ${lineUserId}, status: ${status}`);
  
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select('*')
      .eq('line_user_id', lineUserId)
      .eq('status', status)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ เกิดข้อผิดพลาดในการค้นหา session:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ พบ session ที่ยังใช้งานได้: ${data[0].ref_code}`);
      return data[0];
    }
    
    console.log('⚠️ ไม่พบ session ที่ยังใช้งานได้');
    return null;
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการค้นหา session:', err);
    return null;
  }
}

/**
 * สร้าง session ใหม่
 * @param {Object} sessionData - ข้อมูลของ session ที่ต้องการสร้าง
 * @returns {Promise<Object>} - ผลลัพธ์การสร้าง session
 */
async function createSession(sessionData) {
  console.log('📝 กำลังสร้าง session ใหม่');
  
  try {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .insert([sessionData])
      .select();
    
    if (error) {
      console.error('❌ เกิดข้อผิดพลาดในการสร้าง session:', error);
      return { data: null, error };
    }
    
    console.log(`✅ สร้าง session สำเร็จ: ${data[0].ref_code}`);
    return { data: data[0], error: null };
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการสร้าง session:', err);
    return { data: null, error: err };
  }
}

/**
 * อัปเดต session ตาม ref_code
 * @param {string} refCode - Ref.Code ของ session ที่ต้องการอัปเดต
 * @param {Object} updateData - ข้อมูลที่ต้องการอัปเดต
 * @returns {Promise<Object>} - ผลลัพธ์การอัปเดต session
 */
async function updateSessionByRefCode(refCode, updateData) {
  console.log(`📝 กำลังอัปเดต session ref_code: ${refCode}`);
  
  try {
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .update(updateData)
      .eq('ref_code', refCode)
      .select();
    
    if (error) {
      console.error('❌ เกิดข้อผิดพลาดในการอัปเดต session:', error);
      return { data: null, error };
    }
    
    if (data && data.length > 0) {
      console.log(`✅ อัปเดต session สำเร็จ: ${refCode}`);
      return { data: data[0], error: null };
    }
    
    console.log(`⚠️ ไม่พบ session ที่ต้องการอัปเดต: ${refCode}`);
    return { data: null, error: new Error('Session not found') };
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการอัปเดต session:', err);
    return { data: null, error: err };
  }
}

/**
 * ค้นหา session ตาม ref_code
 * @param {string} refCode - Ref.Code ของ session ที่ต้องการค้นหา
 * @returns {Promise<Object|null>} - ข้อมูล session หรือ null ถ้าไม่พบ
 */
async function findSessionByRefCode(refCode) {
  console.log(`🔍 ค้นหา session สำหรับ ref_code: ${refCode}`);
  
  try {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select('*')
      .eq('ref_code', refCode)
      .limit(1);
    
    if (error) {
      console.error('❌ เกิดข้อผิดพลาดในการค้นหา session:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ พบ session: ${refCode}`);
      return data[0];
    }
    
    console.log(`⚠️ ไม่พบ session สำหรับ ref_code: ${refCode}`);
    return null;
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการค้นหา session:', err);
    return null;
  }
}

module.exports = {
  findActiveSessionByUser,
  createSession,
  updateSessionByRefCode,
  findSessionByRefCode
};
