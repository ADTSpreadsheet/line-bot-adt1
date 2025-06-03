const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');

// ตัวแปรสำหรับการตั้งค่าระบบ
const API2_URL = process.env.API2_URL || 'https://line-bot-adt2.onrender.com';

async function submitStarterSlip(req, res) {
  try {
    // ✅ ขั้นตอนที่ 1: รับข้อมูลจากฟอร์ม
    const {
      ref_code,
      first_name,
      last_name,
      national_id,
      phone_number,
      duration,
      file_content
    } = req.body;

    // ✅ ขั้นตอนที่ 2: ตรวจสอบข้อมูลครบถ้วน
    if (!ref_code || !first_name || !last_name || !national_id || !phone_number || !duration || !file_content) {
      return res.status(400).json({ 
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน' 
      });
    }

    console.log(`🔍 เริ่มประมวลผล ref_code: ${ref_code}`);

    // ✅ ขั้นตอนที่ 3: ตรวจสอบ ref_code ในระบบ
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      console.log(`❌ ไม่พบ ref_code: ${ref_code}`);
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล ref_code ในระบบ'
      });
    }

    const { serial_key, line_user_id } = sessionData;
    console.log(`✅ พบข้อมูล ref_code - line_user_id: ${line_user_id}`);

    // ✅ ขั้นตอนที่ 4: ตรวจสอบข้อมูลซ้ำ
    const { data: existingSubmission } = await supabase
      .from('starter_plan_users')
      .select('id, submissions_status')
      .eq('ref_code', ref_code)
      .single();

    if (existingSubmission) {
      console.log(`⚠️ พบข้อมูลซ้ำ: ${ref_code}`);
      return res.status(409).json({
        success: false,
        message: 'ข้อมูลนี้ถูกส่งไปแล้ว',
        status: existingSubmission.submissions_status
      });
    }

    // ✅ ขั้นตอนที่ 5: เตรียมข้อมูลสำหรับบันทึก
    const duration_minutes = duration * 1440; // แปลงวันเป็นนาที
    const slipFileName = `SP-${ref_code}-${Date.now()}.jpg`;
    const username = `ADT-${ref_code}`;
    const password = serial_key;

    // ✅ จัดการ base64 prefix
    let processedFileContent = file_content;
    if (!file_content.startsWith('data:image/')) {
      processedFileContent = `data:image/jpeg;base64,${file_content}`;
    }

    // ✅ ขั้นตอนที่ 6: อัปโหลดสลิป
    console.log(`📤 กำลังอัปโหลดสลิป: ${slipFileName}`);
    const uploadResult = await uploadBase64Image({
      base64String: processedFileContent,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code
    });

    if (uploadResult.error || !uploadResult.success) {
      console.error(`❌ อัปโหลดสลิปล้มเหลว: ${uploadResult.error}`);
      return res.status(500).json({
        success: false,
        message: 'อัปโหลดสลิปไม่สำเร็จ',
        error: uploadResult.error
      });
    }

    const slipImageUrl = uploadResult.publicUrl;
    console.log(`✅ อัปโหลดสลิปสำเร็จ: ${slipImageUrl}`);

    // ✅ ขั้นตอนที่ 7: บันทึกข้อมูลลงฐานข้อมูล
    console.log(`💾 บันทึกข้อมูลผู้ใช้: ${first_name} ${last_name}`);
    const { data: insertedData, error: insertError } = await supabase
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
          slip_image_url: slipImageUrl,
          submissions_status: 'pending',
          line_user_id,
          username,
          password,
          created_at: new Date().toISOString()
        }
      ])
      .select('id')
      .single();

    if (insertError) {
      console.error(`❌ บันทึกข้อมูลล้มเหลว:`, insertError);
      
      // ลบไฟล์ที่อัปโหลดไปแล้ว
      try {
        await supabase.storage
          .from('statercustumer')
          .remove([`${ref_code}/${slipFileName}`]);
      } catch (deleteError) {
        console.error(`❌ ลบไฟล์ล้มเหลว:`, deleteError);
      }

      return res.status(500).json({
        success: false,
        message: 'บันทึกข้อมูลไม่สำเร็จ',
        error: insertError.message
      });
    }

    console.log(`✅ บันทึกข้อมูลสำเร็จ ID: ${insertedData.id}`);

    // ✅ ขั้นตอนที่ 8: ส่งผลลัพธ์กลับผู้ใช้ทันที
    res.status(200).json({
      success: true,
      message: 'ข้อมูลถูกส่งเรียบร้อยแล้ว กรุณารอการอนุมัติจากแอดมิน',
      data: {
        ref_code,
        username,
        status: 'pending',
        duration_days: duration,
        submitted_at: new Date().toISOString()
      }
    });

    // ✅ ขั้นตอนที่ 9: ส่งการแจ้งเตือนไปยัง API2 (ในเบื้องหลัง)
    try {
      console.log(`📤 ส่งการแจ้งเตือนไปยัง API2...`);
      
      const api2Response = await axios.post(`${API2_URL}/notify-admin-slip`, {
        ref_code,
        duration
      }, {
        timeout: 30000 // 30 วินาที
      });

      if (api2Response.status === 200) {
        console.log(`✅ ส่งการแจ้งเตือนไปยัง API2 สำเร็จ`);
        
        // อัปเดตสถานะเป็น 'notified_admin'
        await supabase
          .from('starter_plan_users')
          .update({ 
            submissions_status: 'notified_admin',
            admin_notified_at: new Date().toISOString()
          })
          .eq('ref_code', ref_code);

      } else {
        console.warn(`⚠️ API2 ตอบกลับด้วยสถานะ: ${api2Response.status}`);
      }

    } catch (api2Error) {
      console.error(`❌ ส่งการแจ้งเตือนไปยัง API2 ล้มเหลว:`, api2Error.message);
      
      // อัปเดตสถานะเป็น 'notification_failed'
      await supabase
        .from('starter_plan_users')
        .update({ 
          submissions_status: 'notification_failed',
          error_message: api2Error.message,
          last_error_at: new Date().toISOString()
        })
        .eq('ref_code', ref_code);
    }

    console.log(`🎉 ประมวลผลเสร็จสิ้น: ${ref_code}`);

  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาด:`, error);
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
      });
    }
  }
}

module.exports = {
  submitStarterSlip
};
