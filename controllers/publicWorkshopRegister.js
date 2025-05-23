const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');

// ✅ สร้าง LINE Client
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// ✅ ฟังก์ชันหลัก
const handlePublicWorkshopRegister = async (req, res) => {
  const { first_name, last_name, phone_number, ref_code, serial_key } = req.body;

  // 🔍 ตรวจสอบ input ว่าครบไหม
  if (!first_name || !last_name || !phone_number || !ref_code || !serial_key) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🔍 Logic 1: ตรวจสอบว่า Ref + Serial Key ตรงใน auth_sessions
  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('line_user_id')
    .eq('ref_code', ref_code)
    .eq('serial_key', serial_key)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return res.status(403).json({ error: 'Ref.Code or Serial Key not found' });
  }

  const line_user_id = sessionData.line_user_id;

  // 📝 Logic 2: อัปเดต source และบันทึกข้อมูล
  await supabase
    .from('auth_sessions')
    .update({
      source: 'attendees',
      first_name,
      last_name,
      phone_number
    })
    .eq('ref_code', ref_code);

  await supabase
    .from('adt_workshop_attendees')
    .insert({
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status: 'attendees'
    });

  // 📤 Flex Message
  const flexMsg = {
    type: 'flex',
    altText: '✅ เข้าร่วมกลุ่มเรียน ADT Workshop',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://wpxpukbvynxawfxcdroj.supabase.co/storage/v1/object/public/adtliveworkshop/Live01.jpg',
        size: 'full',
        aspectRatio: '16:9',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ ยืนยันสิทธิ์เรียบร้อยแล้ว',
            weight: 'bold',
            size: 'lg',
            color: '#00AA00'
          },
          {
            type: 'text',
            text: 'กดปุ่มด้านล่างเพื่อเข้าร่วมกลุ่มเรียน',
            size: 'sm',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1DB446',
            action: {
              type: 'uri',
              label: '📥 เข้ากลุ่มเรียน',
              uri: 'https://line.me/R/ti/g/xJ_XARnCVZ'
            }
          }
        ]
      }
    }
  };

  try {
    await client.pushMessage(line_user_id, flexMsg);
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: '📌 ตอนนี้พี่ได้เข้าห้องเรียนเป็นที่เรียบร้อยแล้ว\nเดี๋ยว อ.เก่ง จะเปิดห้องเรียนในเวลา 24 พ.ค. 2568 เวลา 19:00 น. นะครับ 🕖'
    });
  } catch (err) {
    console.error('❌ Failed to send LINE Flex:', err.message);
    return res.status(200).json({ message: 'Registered, but failed to send LINE message.' });
  }

  return res.status(200).json({ message: 'Registration completed and Flex sent.' });
};

module.exports = { handlePublicWorkshopRegister };
