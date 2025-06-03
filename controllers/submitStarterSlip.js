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
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code ในระบบ' });
    }

    const { serial_key, line_user_id } = sessionData;
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
          line_user_id
        }
      ]);

    if (insertResult.error) {
      console.error("❌ insert starter_plan_users ไม่สำเร็จ:", insertResult.error);
      return res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ', error: insertResult.error });
    }

    // ✅ Logic 3: แจ้ง Bot2 ผ่าน API2
    const response = await axios.post('https://line-bot-adt2.onrender.com/flex/send-starter-slip', {
      ref_code,
      duration
    });

    // ✅ Logic 4: ถ้า Flex ไปหาฝั่ง Admin สำเร็จ → ทำงานต่อ
    if (response.status === 200) {
      const username = `ADT-${ref_code}`;
      const password = serial_key;

      // ✅ อัปเดต username/password
      const { error: updateError } = await supabase
        .from('starter_plan_users')
        .update({ username, password })
        .eq('ref_code', ref_code);

      if (updateError) {
        console.error('❌ อัปเดต username/password ล้มเหลว:', updateError);
        return res.status(500).json({ message: 'อัปเดตข้อมูลใน starter_plan_users ไม่สำเร็จ' });
      }

      // ✅ ส่ง Flex ไปแจ้งลูกค้า
      await axios.post('https://line-bot-adt2.onrender.com/flex/notify-user-starter', {
        ref_code,
        username,
        password,
        duration,
        line_user_id
      });

      return res.status(200).json({
        message: '✅ ส่ง Flex สำเร็จ และอัปเดตข้อมูลเรียบร้อย'
      });

    } else {
      return res.status(500).json({ message: '❌ Bot2 ไม่สามารถส่ง Flex ไปยังแอดมินได้' });
    }

  } catch (err) {
    console.error('❌ ERROR @ submitStarterSlip:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err.message });
  }
}

module.exports = submitStarterSlip;
