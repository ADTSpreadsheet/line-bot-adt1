const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');

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
    if (!ref_code || !first_name || !last_name || !national_id || !phone_number || !duration ) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ✅ Logic 2: ตรวจ ref_code ใน auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code ในระบบ' });
    }

    const { line_user_id } = sessionData;
    const duration_minutes = duration * 1440;

    // ✅ ตั้งชื่อไฟล์สลิปแบบสั้น
    const slipFileName = `SP-${ref_code}.jpg`;

    // ✅ Logic 2.2: อัปโหลดภาพเข้า Supabase
    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code // แยกโฟลเดอร์ตาม ref
    });

    if (uploadError) {
      console.error("❌ อัปโหลดสลิปล้มเหลว:", uploadError);
      return res.status(500).json({ message: 'อัปโหลดภาพไม่สำเร็จ', error: uploadError });
    }

    // ✅ Logic 2.1: บันทึกลง starter_plan_users
    const { error: insertError } = await supabase
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
          line_user_id
        }
      ]);

    if (insertError) {
      console.error("❌ insert starter_plan_users ไม่สำเร็จ:", insertError);
      return res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ', error: insertError });
    }

    // ✅ Logic 3: แจ้ง Bot2 ผ่าน API2
    const response = await axios.post('https://line-bot-adt2.onrender.com/flex/send-starter-slip', {
      ref_code,
      full_name: `${first_name} ${last_name}`,
      duration,
      phone_number,
      image_url: publicUrl
    });

    // ✅ Logic 4: รอ Bot2 ส่ง Flex เสร็จ แล้วตอบกลับหน้าเว็บ
    if (response.status === 200) {
      return res.status(200).json({ message: 'ส่งข้อมูลสำเร็จแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบ' });
    } else {
      return res.status(500).json({ message: 'Bot ไม่สามารถส่ง Flex ได้' });
    }

  } catch (err) {
    console.error('❌ ERROR @ submitStarterSlip:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err.message });
  }
}

module.exports = submitStarterSlip;
