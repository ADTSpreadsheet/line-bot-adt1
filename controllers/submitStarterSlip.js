const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');
const line = require('@line/bot-sdk');

// LINE Bot Client (สร้างเฉพาะเมื่อมี token)
let client = null;
if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  client = new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
} else {
  console.warn('⚠️ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN - จะไม่สามารถส่ง Flex ได้');
}

async function submitStarterSlip(req, res) {
  try {
    const {
      ref_code,
      first_name,
      last_name,
      national_id,
      phone_number,
      duration,
      file_content
    } = req.body;

    // ✅ Logic 1: ตรวจข้อมูล
    if (!ref_code || !first_name || !last_name || !national_id || !phone_number || !duration || !file_content) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ✅ Logic 2.1: ตรวจ ref_code ใน auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      console.error('❌ ไม่พบ sessionData:', sessionError);
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code ในระบบ' });
    }

    const { serial_key, line_user_id } = sessionData;
    
    // 🔍 Debug: ตรวจสอบข้อมูลเบื้องต้น
    console.log('🔍 ข้อมูลเบื้องต้นจาก auth_sessions:');
    console.log('- ref_code:', ref_code);
    console.log('- serial_key:', serial_key);
    console.log('- line_user_id:', line_user_id);

    // ✅ Logic 2.1.5: เช็คว่ามี valid record อยู่แล้วหรือไม่
    const { data: existingValidRecord, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('ref_code_status', 'valid')
      .maybeSingle(); // ใช้ maybeSingle เพื่อไม่ error ถ้าไม่เจอ

    if (checkError) {
      console.error('❌ เช็ค existing record ไม่สำเร็จ:', checkError);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' });
    }

    if (existingValidRecord) {
      console.log('⚠️ พบ valid record อยู่แล้ว:', existingValidRecord.order_number);
      return res.status(409).json({ 
        message: 'มีการซื้อแพคเกจที่ยังใช้งานได้อยู่แล้ว',
        existing_order: existingValidRecord.order_number,
        remaining_minutes: existingValidRecord.remaining_minutes
      });
    }

    const duration_minutes = duration * 1440;

    // ✅ ตั้งชื่อไฟล์สลิปแบบสั้น
    const slipFileName = `SP-${ref_code}.jpg`;

    // ✅ Logic 2.2: อัปโหลดภาพเข้า Supabase
    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code
    });

    if (uploadError) {
      console.error("❌ อัปโหลดสลิปล้มเหลว:", uploadError);
      return res.status(500).json({ message: 'อัปโหลดภาพไม่สำเร็จ', error: uploadError });
    }

    // 🔢 Logic 2.2.5: สร้าง order_number และ price_thb
    console.log('🔢 กำลังสร้าง order_number และคำนวณราคา...');
    
    // หา Sequential Number สำหรับ duration นี้โดยเฉพาะ
    const { data: existingOrders, error: countError } = await supabase
      .from('starter_plan_users')
      .select('order_number')
      .eq('duration_minutes', duration_minutes)
      .not('order_number', 'is', null);

    if (countError) {
      console.error('❌ ไม่สามารถนับจำนวนออเดอร์ได้:', countError);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้าง order number' });
    }

    // หาหมายเลขสูงสุดที่ขึ้นต้นด้วย "{duration}D-"
    const maxOrderNumber = existingOrders
      .filter(order => order.order_number?.startsWith(`${duration}D-`))
      .map(order => {
        const match = order.order_number.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);

    const sequentialNumber = maxOrderNumber + 1;
    const order_number = `${duration}D-${sequentialNumber.toString().padStart(4, '0')}`;
    
    // คำนวณราคา: (5500 ÷ 15) × duration
    const price_thb = Math.round((5500 / 15) * duration * 100) / 100;
    
    console.log('📝 ข้อมูลที่สร้างใหม่:');
    console.log('- Duration (วัน):', duration);
    console.log('- Duration (นาที):', duration_minutes);
    console.log('- Existing Orders for this duration:', existingOrders?.length || 0);
    console.log('- Max Order Number:', maxOrderNumber);
    console.log('- Sequential Number:', sequentialNumber);
    console.log('- Order Number:', order_number);
    console.log('- Price THB:', price_thb);

    // ✅ Logic 2.3: บันทึกลง starter_plan_users
    const insertResult = await supabase
      .from('starter_plan_users')
      .insert([
        {
          ref_code,
          first_name,
          last_name,
          national_id,
          phone_number,
          duration_minutes,
          remaining_minutes: duration_minutes,
          used_minutes: 0,
          slip_image_url: publicUrl,
          submissions_status: 'pending',
          ref_code_status: 'pending', // เพิ่มการกำหนด status เริ่มต้น
          line_user_id,
          order_number,
          price_thb
        }
      ]);

    if (insertResult.error) {
      console.error("❌ insert starter_plan_users ไม่สำเร็จ:", insertResult.error);
      return res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ', error: insertResult.error });
    }

    console.log('✅ บันทึกข้อมูลลง starter_plan_users สำเร็จ พร้อม order_number และ price_thb');

    // ✅ Logic 3: แจ้ง Bot2 ผ่าน API2
    console.log('🛰 กำลังยิงไปยัง:', `${process.env.API2_URL}/starter/notify-admin-slip`);
    
    let response;
    try {
      response = await axios.post(`${process.env.API2_URL}/starter/notify-admin-slip`, {
        ref_code,
        duration
      }, {
        timeout: 10000 // เพิ่ม timeout 10 วินาที
      });
    } catch (apiError) {
      console.error('❌ เรียก API notify-admin-slip ล้มเหลว:', apiError.message);
      return res.status(500).json({ 
        message: 'ไม่สามารถแจ้งเตือนแอดมินได้', 
        error: apiError.message 
      });
    }

    // ✅ Logic 4: ถ้า API2 ตอบกลับสเตตัส 200 = สำเร็จ
    if (response.status === 200) {
      console.log('✅ API2 ตอบกลับสำเร็จ - ส่งแจ้งเตือน Admin แล้ว');
      
      return res.status(200).json({
        message: '✅ บันทึกข้อมูลและแจ้งเตือน Admin สำเร็จ รอการอนุมัติ',
        data: {
          ref_code,
          duration,
          order_number,
          price_thb,
          status: 'pending_approval'
        }
      });
      
    } else {
      console.error('❌ API2 ตอบกลับสถานะไม่ถูกต้อง:', response.status, response.data);
      return res.status(500).json({ 
        message: '❌ ไม่สามารถแจ้งเตือน Admin ได้',
        status: response.status,
        data: response.data
      });
    }

  } catch (err) {
    console.error('❌ ERROR @ submitStarterSlip:', err);
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในระบบ', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = submitStarterSlip;
