/**
 * database.js
 * จัดการ query Supabase แยกจาก service
 */

const supabase = require('./config/supabaseClient');

// ✅ ค้นหา Session ล่าสุดที่ยังใช้งานได้ (PENDING)
const findActiveSessionByUser = async (userId, status) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('line_user_id', userId)
    .eq('status', status)
    .gt('expires_at', new Date().toISOString())
    .order('time_created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
};

// ✅ ดึงจำนวนครั้งที่ผู้ใช้ขอ RefCode
const getRequestCount = async (userId) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('request_count')
    .eq('line_user_id', userId)
    .order('time_created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 0;
  return data.request_count || 0;
};

// ✅ สร้าง session ใหม่
const createSession = async (sessionData) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .insert([sessionData])
    .select();

  return { data, error };
};

// ✅ อัปเดต session
const updateSession = async (sessionId, updateData) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select();

  return { data, error };
};

// ✅ ดึงข้อมูล session โดย Ref Code
const findSessionByRefCode = async (refCode) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('ref_code', refCode)
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return { data, error };
};

// ✅ ดึงข้อมูล session โดย Serial Key
const findSessionBySerialKey = async (serialKey) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('serial_key', serialKey)
    .eq('status', 'VERIFIED')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return { data, error };
};

module.exports = {
  findActiveSessionByUser,
  getRequestCount,
  createSession,
  updateSession,
  findSessionByRefCode,
  findSessionBySerialKey
};
