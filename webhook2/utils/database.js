// database.js - ฟังก์ชันสำหรับจัดการฐานข้อมูล Supabase

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// สร้าง Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

/**
 * บันทึกข้อมูลการลงทะเบียนใหม่ลงใน Supabase
 * @param {Object} registrationData - ข้อมูลการลงทะเบียนจาก VBA
 * @returns {Promise} ผลลัพธ์จากการบันทึกข้อมูล
 */
async function saveRegistration(registrationData) {
  try {
    // แปลงข้อมูลจาก VBA ให้ตรงกับโครงสร้างตาราง
    const userData = {
      first_name: registrationData.name,
      last_name: registrationData.email,
      house_number: registrationData.phone,
      district: registrationData.district,
      province: registrationData.province,
      phone_number: registrationData.phone,
      email: registrationData.email,
      national_id: registrationData.nationalId,
      ip_address: registrationData.ipAddress || null,
      machine_id: registrationData.machineId || null,
      line_user_id: null, // อาจไม่มีข้อมูลนี้จาก VBA
      day_created_at: new Date(),
      verify_at: new Date(),
      expires_at: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 วัน
      status: 'active'
    };

    // บันทึกข้อมูลลงใน Supabase
    const { data, error } = await supabase
      .from(config.REGISTRATIONS_TABLE)
      .insert([userData])
      .select();

    if (error) {
      console.error('[Webhook2] Error saving registration:', error);
      throw error;
    }

    console.log('[Webhook2] Registration saved successfully:', data);
    return data;
  } catch (error) {
    console.error('[Webhook2] Database error:', error);
    throw error;
  }
}

/**
 * ตรวจสอบว่ามีการลงทะเบียนซ้ำหรือไม่
 * @param {string} email - อีเมลที่ต้องการตรวจสอบ
 * @param {string} nationalId - เลขบัตรประชาชนที่ต้องการตรวจสอบ
 * @returns {Promise<boolean>} true ถ้ามีการลงทะเบียนซ้ำ, false ถ้าไม่มี
 */
async function checkDuplicateRegistration(email, nationalId) {
  try {
    // ตรวจสอบอีเมล
    if (email) {
      const { data: emailData, error: emailError } = await supabase
        .from(config.REGISTRATIONS_TABLE)
        .select('id')
        .eq('email', email)
        .limit(1);

      if (emailError) {
        console.error('[Webhook2] Error checking email:', emailError);
        throw emailError;
      }

      if (emailData && emailData.length > 0) {
        return true; // พบอีเมลซ้ำ
      }
    }

    // ตรวจสอบเลขบัตรประชาชน
    if (nationalId) {
      const { data: idData, error: idError } = await supabase
        .from(config.REGISTRATIONS_TABLE)
        .select('id')
        .eq('national_id', nationalId)
        .limit(1);

      if (idError) {
        console.error('[Webhook2] Error checking national ID:', idError);
        throw idError;
      }

      if (idData && idData.length > 0) {
        return true; // พบเลขบัตรประชาชนซ้ำ
      }
    }

    return false; // ไม่พบข้อมูลซ้ำ
  } catch (error) {
    console.error('[Webhook2] Error checking duplicate:', error);
    throw error;
  }
}

module.exports = {
  saveRegistration,
  checkDuplicateRegistration
};
