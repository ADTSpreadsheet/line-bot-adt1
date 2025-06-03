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
      console.error('❌ ไม่พบ sessionData:', sessionError);
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code ในระบบ' });
    }

    const { serial_key, line_user_id } = sessionData;
    
    // 🔍 Debug: ตรวจสอบข้อมูลเบื้องต้น
    console.log('🔍 ข้อมูลเบื้องต้นจาก auth_sessions:');
    console.log('- ref_code:', ref_code);
    console.log('- serial_key:', serial_key);
    console.log('- line_user_id:', line_user_id);

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

    // ✅ Logic 4: ถ้า API2 ตอบกลับสเตตัส 200 พร้อม ref_code และ duration
    if (response.status === 200 && response.data) {
      console.log('✅ API2 ตอบกลับสำเร็จ:', response.data);
      
      // 🔍 รับข้อมูลจาก API2 response
      const { ref_code: returnedRefCode, duration: returnedDuration } = response.data;
      
      console.log('📝 ข้อมูลที่ได้จาก API2:');
      console.log('- Returned ref_code:', returnedRefCode);
      console.log('- Returned duration:', returnedDuration);
      
      if (!returnedRefCode) {
        console.error('❌ API2 ไม่ได้ส่ง ref_code กลับมา');
        return res.status(500).json({ message: 'API2 ไม่ได้ส่ง ref_code กลับมา' });
      }

      // ✅ ใช้ ref_code ที่ได้จาก API2 ไปค้นหา line_user_id ใหม่
      const { data: sessionData2, error: sessionError2 } = await supabase
        .from('auth_sessions')
        .select('serial_key, line_user_id')
        .eq('ref_code', returnedRefCode)
        .single();

      if (sessionError2 || !sessionData2) {
        console.error('❌ ไม่พบข้อมูล auth_sessions สำหรับ ref_code:', returnedRefCode);
        return res.status(404).json({ message: `ไม่พบข้อมูล ref_code: ${returnedRefCode} ในระบบ` });
      }

      const { serial_key: finalSerialKey, line_user_id: finalLineUserId } = sessionData2;
      
      console.log('🔍 ข้อมูลที่ค้นพบจาก auth_sessions:');
      console.log('- serial_key:', finalSerialKey);
      console.log('- line_user_id:', finalLineUserId);

      if (!finalLineUserId) {
        console.error('❌ ไม่พบ line_user_id สำหรับ ref_code:', returnedRefCode);
        return res.status(400).json({ message: `ไม่พบ LINE User ID สำหรับ ref_code: ${returnedRefCode}` });
      }

      const username = `ADT-${returnedRefCode}`;
      const password = finalSerialKey;

      // ✅ อัปเดต username/password
      const { error: updateError } = await supabase
        .from('starter_plan_users')
        .update({ username, password })
        .eq('ref_code', returnedRefCode);

      if (updateError) {
        console.error('❌ อัปเดต username/password ล้มเหลว:', updateError);
        return res.status(500).json({ message: 'อัปเดตข้อมูลใน starter_plan_users ไม่สำเร็จ' });
      }

      // ✅ ส่ง Flex ไปแจ้งลูกค้า
      try {
        if (client) {
          console.log('📱 ใช้ LINE SDK ส่ง Flex Message');
          
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
                    text: `- Ref.Code: ${returnedRefCode}`,
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
                    text: `- ระยะเวลาการใช้งาน: ${returnedDuration} วัน`,
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

          console.log('📤 กำลังส่ง Flex Message ไปยัง LINE User:', finalLineUserId);
          const lineResponse = await client.pushMessage(finalLineUserId, flexMessage);
          console.log('✅ ส่ง LINE Flex Message สำเร็จ:', lineResponse);
          
        } else {
          console.log('🌐 ใช้ axios เรียก API Bot อื่น');
          
          const notifyResponse = await axios.post(`${process.env.API2_URL}/starter/notify-user-starter`, {
            ref_code: returnedRefCode,          
            duration: returnedDuration,
            line_user_id: finalLineUserId
          }, {
            timeout: 10000
          });
          
          console.log('✅ เรียก notify-user-starter สำเร็จ:', notifyResponse.status);
        }

        return res.status(200).json({
          message: '✅ ส่ง Flex สำเร็จ และอัปเดตข้อมูลเรียบร้อย',
          data: {
            ref_code: returnedRefCode,
            username,
            duration: returnedDuration
          }
        });
        
      } catch (flexError) {
        console.error('❌ ส่ง Flex Message ล้มเหลว:', flexError);
        
        return res.status(200).json({
          message: '⚠️ บันทึกข้อมูลสำเร็จ แต่ส่งแจ้งเตือนไม่สำเร็จ',
          warning: 'กรุณาตรวจสอบการตั้งค่า LINE Bot',
          data: {
            ref_code: returnedRefCode,
            username,
            duration: returnedDuration
          },
          error: flexError.message
        });
      }
      
    } else {
      console.error('❌ API2 ตอบกลับสถานะไม่ถูกต้องหรือไม่มีข้อมูล:', response.status, response.data);
      return res.status(500).json({ 
        message: '❌ API2 ไม่ได้ส่งข้อมูลที่จำเป็นกลับมา',
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
