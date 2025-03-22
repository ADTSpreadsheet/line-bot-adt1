/**
 * config/supabaseClient.js
 * ตั้งค่าการเชื่อมต่อกับ Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const CONFIG = require('./index');

const supabaseUrl = CONFIG.SUPABASE.URL;
const supabaseKey = CONFIG.SUPABASE.SERVICE_ROLE_KEY; // ใช้ service_role สำหรับ backend เท่านั้น

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Connected to Supabase');

module.exports = supabase;
