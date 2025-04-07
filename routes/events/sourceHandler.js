// File: routes/events/sourceHandler.js

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wpxpukbvynxawfxcdroj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweHB1a2J2eW54YXdmeGNkcm9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjM4Njc5MiwiZXhwIjoyMDU3OTYyNzkyfQ.tgeHy_TMIx6UuQLBXDiKYTi8QyeO7fMI7ZSRuEBiUKM');

// ฟังก์ชันคัดแยก `source` และบันทึกลง Supabase
const handleSource = async (userId, source) => {
  const timestamp = new Date().toISOString();

  // ตรวจสอบว่า `source` มาจากช่องทางไหน (UserForm3, VerifyLicenseForm, หรือ Line Original)
  let sourceType;
  if (source === 'UserForm3') {
    sourceType = 'UserForm3';
  } else if (source === 'VerifyLicenseForm') {
    sourceType = 'VerifyLicenseForm';
  } else if (source === 'LineOriginal') {
    sourceType = 'LineOriginal';
  } else {
    sourceType = 'Unknown';  // กรณีที่ไม่มี `source`
  }

  // บันทึกข้อมูล `source` ลงใน Supabase
  try {
    const { data, error } = await supabase
      .from('auth_sessions') // ชื่อตารางใน Supabase ที่จะบันทึกข้อมูล
      .upsert([
        {
          line_user_id: userId,  // Line User ID
          source: sourceType,     // เก็บข้อมูล source ที่แยกได้จาก QR Code
          created_at: timestamp,  // เวลาที่บันทึก
        }
      ]);

    if (error) {
      throw error;
    }

    console.log('ข้อมูล `source` ถูกบันทึกเรียบร้อย:', data);
  } catch (error) {
    console.error('การบันทึกข้อมูล `source` ล้มเหลว:', error.message);
  }
};

module.exports = { handleSource };
