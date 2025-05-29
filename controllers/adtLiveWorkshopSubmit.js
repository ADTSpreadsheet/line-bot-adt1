// =====================================
// ✅ SECTION 1: IMPORT LIBRARIES
// =====================================
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});


// =====================================
// ✅ SECTION 2: FLEX MESSAGE FUNCTION
// =====================================
async function sendFlexToUser(userId, { title, imageUrl, zoomLink, password }) {
  const flexMessage = {
    type: 'flex',
    altText: '📢 ยืนยันเข้าร่วม ADTLive Workshop',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'lg',
            wrap: true
          },
          {
            type: 'text',
            text: '🔐 รหัสผ่าน Zoom: ' + password,
            size: 'sm',
            color: '#555555',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: '🔗 เข้าร่วม Zoom',
              uri: zoomLink
            },
            color: '#2563eb'
          }
        ]
      }
    }
  };

  try {
    await client.pushMessage(userId, flexMessage);
    console.log("✅ ส่ง Flex แบบมีปุ่มสำเร็จ →", userId);
  } catch (err) {
    console.error("❌ Flex Error:", err.originalError?.response?.data || err.message);
  }
}


  try {
    await client.pushMessage(userId, flexMessage);
    console.log("✅ ส่ง Flex สำเร็จ →", userId);
  } catch (err) {
    console.error("❌ ส่ง Flex ล้มเหลว:", err.originalError?.response?.data || err.message);
  }
}


// =====================================
// ✅ SECTION 3: MAIN HANDLER FUNCTION
// =====================================
const handleSubmitLiveWorkshop = async (req, res) => {
  try {
    // 🔸 รับข้อมูลจาก Web
    const {
      ref_code,
      serial_key,
      first_name,
      last_name,
      phone_number,
      student_status
    } = req.body;

    // 🔸 ตรวจสอบข้อมูลครบไหม
    if (!ref_code || !serial_key || !first_name || !last_name || !phone_number) {
      return res.status(400).json({
        error: "❌ กรอกข้อมูลไม่ครบ กรุณาลองใหม่อีกครั้ง"
      });
    }

    // 🔍 ตรวจสอบ Ref.Code + Serial Key
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();

    if (sessionError || !sessionData) {
      return res.status(400).json({
        error: "❌ ไม่พบ Ref.Code หรือ Serial Key นี้ในระบบ"
      });
    }

    const line_user_id = sessionData.line_user_id;

    // 📦 เตรียมข้อมูล insert
    const insertData = {
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status,
      adt_class_no: 'ADTLive[02]',
      has_adt: student_status === 'attendees' ? false : true,
      registered_at: new Date().toISOString()
    };

    // ✅ Step 1: Insert ลง adt_workshop_attendees
    const { error: insertError } = await supabase
      .from('adt_workshop_attendees')
      .insert([insertData]);

    if (insertError) {
      return res.status(500).json({
        error: "❌ ไม่สามารถลงทะเบียนได้",
        detail: insertError.message
      });
    }

    // ✅ Step 2: อัปเดต auth_sessions ด้วยข้อมูลผู้ใช้
    await supabase
      .from('auth_sessions')
      .update({
        first_name,
        last_name,
        phone_number
      })
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key);

    // ✅ Step 3: ส่ง Flex Message ไป LINE
    await sendFlexToUser(line_user_id, {
      title: "🎓 ยินดีต้อนรับเข้าสู่ ADTLive Workshop",
      imageUrl: "https://wpxpukbvynxawfxcdroj.supabase.co/storage/v1/object/public/adtliveworkshop/Live02.jpg",
      zoomLink: "https://us06web.zoom.us/j/87599526391?pwd=U0wdvFqGbHaaLrlkEWbO7fRbaHqNw9.1",
      password: "ADT0531"
    });

    // ✅ Step 4: ตอบกลับ 200
    return res.status(200).json({
      message: "✅ ลงทะเบียนเรียบร้อย และส่งลิงก์ Zoom แล้ว"
    });

  } catch (err) {
    // ❌ จัดการ Error ที่ไม่ได้คาดไว้
    return res.status(500).json({
      error: "❌ เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
      detail: err.message
    });
  }
};


// =====================================
// ✅ SECTION 4: EXPORT HANDLER
// =====================================
module.exports = { handleSubmitLiveWorkshop };
