// File: routes/events/QR_Codes.js

const { createClient } = require('@supabase/supabase-js');
const qr = require('qr-image'); // ใช้สำหรับสร้าง QR Code
const supabase = createClient('https://your-project.supabase.co', 'your-api-key');

// ฟังก์ชันในการสร้าง QR Code ที่ฝังข้อมูล source
const createQRCode = async (source) => {
  const url = `https://line.me/R/ti/p/%40yourlineid?source=${source}`; // ปรับ URL ตามที่ต้องการ
  const qrImage = qr.imageSync(url, { type: 'png' });

  // Save the QR code image to your desired folder
  const fs = require('fs');
  const fileName = `./QR_Codes/${source}_QRCode.png`;
  fs.writeFileSync(fileName, qrImage);

  console.log(`QR Code saved as ${fileName}`);
  return fileName;
};

// ฟังก์ชันที่จัดการการสร้างและบันทึกข้อมูลลงใน Supabase
const saveQRCodeToSupabase = async (source) => {
  const filePath = await createQRCode(source);

  // บันทึกข้อมูล `source` ลงใน Supabase
  const { data, error } = await supabase
    .from('auth_sessions')
    .upsert([
      {
        source: source,  // ค่าของ source ที่ฝังใน QR Code
        created_at: new Date().toISOString(),
        file_path: filePath
      }
    ]);

  if (error) {
    console.error('Error saving to Supabase:', error.message);
  } else {
    console.log('QR Code data saved to Supabase:', data);
  }
};

// เรียกใช้ฟังก์ชันการบันทึกข้อมูล
const sources = ['UserForm3', 'VerifyLicenseForm', 'LineOriginal']; // กำหนดช่องทางต่าง ๆ ที่ใช้ในระบบ
sources.forEach(async (source) => {
  await saveQRCodeToSupabase(source);  // สร้าง QR Code และบันทึกข้อมูลลง Supabase
});
