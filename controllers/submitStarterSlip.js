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
      file_name,
      file_content,
    } = req.body;

    // ✅ Logic 1: ตรวจข้อมูล
    if (!ref_code || !first_name || !last_name || !national_id || !phone_number || !duration || !file_name || !file_content) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ✅ Logic 2: ดึงข้อมูลจาก auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ไม่พบ ref_code ในระบบ' });
    }

    const { line_user_id } = sessionData;

    // ✅ Logic 2.1: บันทึกลง starter_plan_users
    const duration_minutes = duration * 1440;
    const insertUser = await supabase.from('starter_plan_users').insert([
      {
        ref_code,
        first_name,
        last_name,
        national_id,
        phone_number,
        duration_minutes,
        remaining_minutes: duration_minutes,
        submissions_status: 'pending',
        line_user_id,
      }
    ]);

    if (insertUser.error) {
      return res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลผู้ใช้ได้', error: insertUser.error });
    }

    // ✅ Logic 2.2: อัปโหลดภาพไป statercustumer bucket
    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: file_name,
      bucketName: 'statercustumer'
    });

    if (uploadError) {
      return res.status(500).json({ message: 'ไม่สามารถอัปโหลดภาพได้', error: uploadError });
    }

    await supabase
      .from('starter_plan_users')
      .update({ slip_image_url: publicUrl })
      .eq('ref_code', ref_code);

    // ✅ Logic 3: POST ไปยัง API2 เพื่อส่ง Flex
    const response = await axios.post('https://line-bot-adt2.onrender.com/flex/send-starter-slip', {
      ref_code,
      full_name: `${first_name} ${last_name}`,
      duration,
      phone_number,
      image_url: publicUrl
    });

    // ✅ Logic 4: แจ้งกลับลูกค้า + ตอบ 200
    if (response.status === 200) {
      return res.status(200).json({ message: 'ส่งข้อมูลสำเร็จแล้ว กรุณารอการตรวจสอบจากเจ้าหน้าที่' });
    } else {
      return res.status(500).json({ message: 'Bot ไม่สามารถส่งข้อความได้' });
    }

  } catch (err) {
    console.error('❌ submitStarterSlip Error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err });
  }
}

// ✅ Export ไปใช้งาน
module.exports = submitStarterSlip;
