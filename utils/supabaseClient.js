// utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
// Load environment variables
dotenv.config();
// Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log("🧪 SUPABASE KEY (prefix):", supabaseKey.slice(0, 20));
// ตรวจสอบว่า .env มีค่าครบหรือไม่
if (!supabaseUrl || !supabaseKey) {
 console.error('❌ Supabase credentials not found in environment variables!');
 console.error('   Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env file');
 process.exit(1);
}
// สร้าง Client สำหรับเชื่อมต่อ Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
 auth: {
   autoRefreshToken: false,
   persistSession: false
 }
});
// ทดสอบการเชื่อมต่อ Supabase
const testConnection = async () => {
 try {
   // ใช้ auth.getSession() แทนการใช้ aggregate function
   const { data, error } = await supabase.auth.getSession();
   
   if (error) {
     console.error('❌ Failed to connect to Supabase:', error.message);
     return false;
   }
   
   console.log('✅ Successfully connected to Supabase at:', supabaseUrl);
   return true;
 } catch (err) {
   console.error('❌ Failed to connect to Supabase:', err.message);
   return false;
 }
};
// Call the test connection function when the module is imported
// (but don't block the export)
testConnection().catch(err => {
 console.error('❌ Unexpected error testing Supabase connection:', err);
});
module.exports = {
 supabase,
 testConnection
};
