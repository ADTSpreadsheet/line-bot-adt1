const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');
const line = require('@line/bot-sdk');

// LINE Bot Client (สร้างเฉพาะเมื่อมี token)
let client = null;
if (process.env.LINE_BOT_ACCESS_TOKEN) {
  client = new line.Client({
    channelAccessToken: process.env.LINE_BOT_ACCESS_TOKEN
  });
} else {
  console.warn('⚠️ ไม่พบ LINE_BOT_ACCESS_TOKEN - จะใช้ axios แทน');
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
    const response = await axios.post(`${process.env.API2_URL}/starter/notify-admin-slip`, {
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
      if (client) {
        // ใช้ LINE SDK
        const flexMessage = {
          type: "flex",
          altText: "แจ้งเตือนสถานะการสั่งซื้อ",
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "📌 แจ้งเตือนสถานะการสั่งซื้อ",
                  weight: "bold",
                  color: "#007BFF",
                  size: "lg"
                }
              ],
              backgroundColor: "#F8F9FA",
              paddingAll: "lg"
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                {
                  type: "text",
                  text: "รายละเอียด Starter Plan ของท่านคือ:",
                  weight: "bold",
                  size: "md"
                },
                {
                  type: "text",
                  text: `- Ref.Code: ${ref_code}`,
                  size: "sm"
                },
                {
                  type: "text",
                  text: `- Username: ${username}`,
                  size: "sm"
                },
                {
                  type: "text",
                  text: `- Password: ${password}`,
                  size: "sm"
                },
                {
                  type: "text",
                  text: `- ระยะเวลาการใช้งาน: ${duration} วัน`,
                  size: "sm"
                },
                {
                  type: "text",
                  text: "ท่านสามารถนำข้อมูลไปทำการ Login ที่หน้าโปรแกรม ADTSpreadsheet ได้เลยครับ ✅",
                  wrap: true,
                  size: "sm",
                  color: "#28A745"
                }
              ],
              paddingAll: "lg"
            }
          }
        };

        // ส่ง Flex Message ไปยัง line_user_id
        await client.pushMessage(line_user_id, flexMessage);
      } else {
        // ใช้ axios เรียก API Bot อื่น
        await axios.post(`${process.env.API2_URL}/starter/notify-admin-starter`, {
          ref_code,          
          duration         
        });
      }

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
