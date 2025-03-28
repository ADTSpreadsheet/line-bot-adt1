// utils/database.js
const { supabase } = require('./supabaseClient');
const logger = require('./logger');

/**
 * สร้างข้อมูล Ref.Code + Serial Key ใน Supabase
 * @param {string} refCode - รหัสอ้างอิง
 * @param {string} serialKey - Serial Key
 * @param {string} lineUserId - LINE User ID
 * @returns {Promise<Object>} - ข้อมูลที่สร้าง
 */
exports.createRefCodeInSupabase = async (refCode, serialKey, lineUserId) => {
  // คำนวณเวลาหมดอายุ (15 นาที)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  
  // ข้อมูลที่จะบันทึก
  const sessionData = {
    ref_code: refCode,
    serial_key: serialKey,
    line_user_id: lineUserId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_verified: false,
    status: 'PENDING',
    request_count: 1,
    failed_attempts: 0
  };
  
  const { data, error } = await supabase
    .from('auth_sessions')
    .insert([sessionData])
    .select();

  if (error) {
    logger.error(`❌ Failed to insert Ref.Code ${refCode}:`, error.message);
    throw error;
  }
  
  logger.info(`✅ Created Ref.Code: ${refCode} with Serial Key: ${serialKey} for LINE User: ${lineUserId}`);
  return data[0];
};

/**
 * ตรวจสอบว่า Ref.Code นี้มีอยู่หรือไม่
 * @param {string} refCode - รหัสอ้างอิง
 * @returns {Promise<boolean>} - ผลการตรวจสอบ
 */
exports.checkRefCodeExists = async (refCode) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('id')
    .eq('ref_code', refCode)
    .maybeSingle();

  if (error) {
    logger.error(`❌ Error checking Ref.Code: ${refCode}`, error.message);
    throw error;
  }
  
  return !!data;
};

/**
 * ตรวจสอบว่าผู้ใช้มีการลงทะเบียนที่ยังไม่หมดอายุหรือไม่
 * @param {string} lineUserId - LINE User ID
 * @returns {Promise<Object|null>} - ข้อมูลระยะเวลาทดลองใช้
 */
exports.validateTrialPeriod = async (lineUserId) => {
  const { data, error } = await supabase
    .from('registered_machines')
    .select('ref_code, trial_start_date, trial_end_date')
    .eq('line_user_id', lineUserId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    logger.error(`❌ Error checking trial period for user: ${lineUserId}`, error.message);
    throw error;
  }

  if (!data || !data.trial_end_date) {
    return null;
  }

  const now = new Date();
  const endDate = new Date(data.trial_end_date);
  
  // ตรวจสอบว่าช่วงทดลองยังไม่หมดอายุ
  if (endDate > now) {
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return {
      isActive: true,
      ref_code: data.ref_code,
      daysLeft,
      endDate: data.trial_end_date
    };
  }
  
  return null;
};

/**
 * ตรวจสอบ Serial Key กับ Ref.Code
 * @param {string} refCode - รหัสอ้างอิง
 * @param {string} serialKey - Serial Key
 * @returns {Promise<Object|null>} - ข้อมูลการตรวจสอบ
 */
exports.getSerialKeyByRefCode = async (refCode, serialKey) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('expires_at, created_at')
    .eq('ref_code', refCode)
    .eq('serial_key', serialKey)
    .maybeSingle();

  if (error) {
    logger.error(`❌ Error verifying Serial Key: ${refCode}`, error.message);
    throw error;
  }

  if (!data) return null;

  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  const isExpired = expiresAt < now;
  
  // คำนวณเวลาที่เหลือในนาที
  const remainingMinutes = isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60));

  return {
    isExpired,
    expires_at: data.expires_at,
    created_at: data.created_at,
    remainingMinutes
  };
};

/**
 * อัปเดตสถานะ Ref.Code ว่าผ่านการยืนยันแล้ว
 * @param {string} refCode - รหัสอ้างอิง
 * @returns {Promise<Object>} - ข้อมูลที่อัปเดต
 */
exports.updateVerifyStatus = async (refCode) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .update({ 
      is_verified: true, 
      verify_at: new Date().toISOString(),
      status: 'VERIFIED'
    })
    .eq('ref_code', refCode)
    .select();

  if (error) {
    logger.error(`❌ Failed to update verify status for ${refCode}:`, error.message);
    throw error;
  }

  logger.info(`✅ Updated verify status for Ref.Code: ${refCode}`);
  return data[0];
};

/**
 * ดึงสถานะของ Ref.Code
 * @param {string} refCode - รหัสอ้างอิง
 * @returns {Promise<Object|null>} - ข้อมูลสถานะ
 */
exports.getRefCodeStatus = async (refCode) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('is_verified, line_user_id, status, expires_at, created_at')
    .eq('ref_code', refCode)
    .maybeSingle();

  if (error) {
    logger.error(`❌ Error getting Ref.Code status: ${refCode}`, error.message);
    throw error;
  }

  if (!data) return null;

  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  const isExpired = expiresAt < now;

  return {
    ...data,
    isExpired,
    remainingTime: isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60))
  };
};

/**
 * บันทึกข้อมูลผู้ใช้และ Machine ID
 * @param {string} refCode - รหัสอ้างอิง
 * @param {string} machineId - Machine ID
 * @param {Object} userData - ข้อมูลผู้ใช้
 * @returns {Promise<Object>} - ข้อมูลที่บันทึก
 */
exports.saveUserData = async (refCode, machineId, userData) => {
  // ดึงข้อมูล session ก่อน
  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('line_user_id')
    .eq('ref_code', refCode)
    .maybeSingle();

  if (sessionError || !sessionData) {
    logger.error(`❌ Error finding session for Ref.Code: ${refCode}`, sessionError?.message || 'Session not found');
    throw new Error('Session not found');
  }

  const lineUserId = sessionData.line_user_id;
  const now = new Date();

  // บันทึกข้อมูลในตาราง registered_machines
  const registrationData = {
    ref_code: refCode,
    machine_id: machineId,
    line_user_id: lineUserId,
    registered_at: now.toISOString(),
    user_data: userData,
    status: 'ACTIVE',
    last_active: now.toISOString()
  };

  const { data, error } = await supabase
    .from('registered_machines')
    .insert([registrationData])
    .select();

  if (error) {
    logger.error(`❌ Failed to save user data for ${refCode}:`, error.message);
    throw error;
  }

  logger.info(`✅ Saved user data for Ref.Code: ${refCode}, Machine ID: ${machineId}`);
  return data[0];
};

/**
 * บันทึกข้อมูลระยะเวลาทดลองใช้
 * @param {string} refCode - รหัสอ้างอิง
 * @param {string} machineId - Machine ID
 * @param {Object} trialPeriod - ข้อมูลระยะเวลาทดลองใช้
 * @returns {Promise<Object>} - ข้อมูลที่บันทึก
 */
exports.saveTrialPeriod = async (refCode, machineId, trialPeriod) => {
  const { data, error } = await supabase
    .from('registered_machines')
    .update({
      trial_start_date: trialPeriod.start_date,
      trial_end_date: trialPeriod.end_date
    })
    .eq('ref_code', refCode)
    .eq('machine_id', machineId)
    .select();

  if (error) {
    logger.error(`❌ Failed to save trial period for ${refCode}:`, error.message);
    throw error;
  }

  logger.info(`✅ Saved trial period for Ref.Code: ${refCode}, end date: ${trialPeriod.end_date}`);
  return data[0];
};

/**
 * ส่ง Serial Key ซ้ำไปยังผู้ใช้
 * @param {string} refCode - รหัสอ้างอิง
 * @returns {Promise<Object|null>} - ข้อมูลที่ต้องการส่งซ้ำ
 */
exports.resendSerialKeyToLine = async (refCode) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('line_user_id, serial_key, expires_at')
    .eq('ref_code', refCode)
    .maybeSingle();

  if (error) {
    logger.error(`❌ Error getting data for resend: ${refCode}`, error.message);
    throw error;
  }

  if (!data) return null;

  const now = new Date();
  const expiresAt = new Date(data.expires_at);
  const isExpired = expiresAt < now;
  
  // คำนวณเวลาที่เหลือในนาที
  const expiresInMinutes = isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60));

  // อัปเดตจำนวนครั้งที่ขอส่งซ้ำ
  await supabase
    .from('auth_sessions')
    .update({ request_count: supabase.rpc('increment', { x: 1 }) })
    .eq('ref_code', refCode);

  return {
    line_user_id: data.line_user_id,
    serial_key: data.serial_key,
    isExpired,
    expiresInMinutes
  };
};
