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

/**
* ค้นหา session จาก ref code
* @param {string} refCode - รหัสอ้างอิง
* @returns {Promise}
*/
const findSessionByRefCode = async (refCode) => {
 const { data, error } = await supabase
   .from('auth_sessions')
   .select('*')
   .eq('ref_code', refCode)
   .eq('status', 'PENDING')
   .gt('expires_at', new Date().toISOString())
   .single();
 
 return { data, error };
};

/**
* ค้นหา session จาก serial key
* @param {string} serialKey - Serial Key
* @returns {Promise}
*/
const findSessionBySerialKey = async (serialKey) => {
 const { data, error } = await supabase
   .from('auth_sessions')
   .select('*')
   .eq('serial_key', serialKey)
   .eq('status', 'AWAITING_VERIFICATION')
   .gt('expires_at', new Date().toISOString())
   .single();
 
 return { data, error };
};

/**
* สร้าง session ใหม่
* @param {Object} sessionData - ข้อมูล session ที่จะสร้าง
* @returns {Promise}
*/
const createSession = async (sessionData) => {
 return await supabase.from('auth_sessions').insert([sessionData]).select();
};

/**
* อัปเดต session
* @param {string} id - ID ของ session
* @param {Object} updateData - ข้อมูลที่จะอัปเดต
* @returns {Promise}
*/
const updateSession = async (id, updateData) => {
 return await supabase
   .from('auth_sessions')
   .update(updateData)
   .eq('id', id)
   .select();
};

/**
* ตรวจสอบจำนวนครั้งที่ผู้ใช้ได้ขอ Ref Code
* @param {string} userId - LINE user ID
* @returns {Promise<number>} - จำนวนครั้งที่ขอแล้ว
*/
const getRequestCount = async (userId) => {
 const { data, error } = await supabase
   .from('auth_sessions')
   .select('request_count')
   .eq('line_user_id', userId)
   .order('created_at', { ascending: false })
   .limit(1)
   .single();

 if (error || !data) {
   return 0;
 }
 
 return data.request_count || 0;
};

/**
* ตรวจสอบจำนวนครั้งที่ผู้ใช้ได้กดปุ่ม Verify
* @param {string} id - ID ของ session
* @returns {Promise<number>} - จำนวนครั้งที่กดแล้ว
*/
const getVerifyCount = async (id) => {
 const { data, error } = await supabase
   .from('auth_sessions')
   .select('verify_count')
   .eq('id', id)
   .single();

 if (error || !data) {
   return 0;
 }
 
 return data.verify_count || 0;
};

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
