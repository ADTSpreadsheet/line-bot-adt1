// ตรวจสอบว่าโหลด dotenv หรือยัง
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ใช้ SERVICE_ROLE_KEY

// Debug: แสดงค่า environment variables (ซ่อน key บางส่วน)
console.log('🔧 Supabase URL:', supabaseUrl);
console.log('🔑 Service Key (first 20 chars):', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'NOT FOUND');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
    } else {
      console.log('✅ Supabase connected successfully');
      console.log('📁 Available buckets:', data.map(b => b.name));
    }
  } catch (err) {
    console.error('❌ Connection test error:', err);
  }
};

// เรียกใช้ test เมื่อโหลดไฟล์ (เฉพาะใน development)
if (process.env.NODE_ENV !== 'production') {
  testConnection();
}

module.exports = { supabase };
