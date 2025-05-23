const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const handlePublicWorkshopRegister = async (req, res) => {
  const { first_name, last_name, phone_number, ref_code, serial_key } = req.body;

  // 🔹 ตรวจสอบความครบของข้อมูล
  if (!first_name || !last_name || !phone_number || !ref_code || !serial_key) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🔹 Logic 1: ตรวจสอบ Ref.Code และ Serial Key
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

  // 🔹 Logic 2: อัปเดต source ใน auth_sessions และบันทึกข้อมูล
  await supabase
    .from('auth_sessions')
    .update({
      source: 'attendees',
      first_name,
      last_name,
      phone_number
    })
    .eq('ref_code', ref_code);

  // 🔹 Insert ลงตาราง adt_workshop_attendees
  const { error: insertError } = await supabase
    .from('adt_workshop_attendees')
    .insert({
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status: 'attendees'
    });

  if (insertError) {
    return res.status(500).json({ error: 'Failed to save workshop registration' });
  }

  // 🔹 ส่ง Flex Message เข้าไลน์
  try {
    const message = {
      type: 'flex',
      altText: '✅ ยืนยันเข้าร่วมกลุ่มเรียน ADT Workshop',
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

    await sendLineMessage(line_user_id, message);

    await sendLineMessage(line_user_id, {
      type: 'text',
      text: '📌 ตอนนี้พี่ได้เข้าห้องเรียนเป็นที่เรียบร้อยแล้ว\nเดี๋ยว อ.เก่ง จะทำการเปิดห้องเรียนในเวลา 24 พ.ค. 2568 เวลา 19:00 น. นะครับ 🕖'
    });

  } catch (err) {
    console.error('❌ Failed to send LINE Flex:', err.message);
    return res.status(200).json({ message: 'Registered, but failed to send LINE message.' });
  }

  // 🔚 ส่ง 200 กลับให้ VBA
  return res.status(200).json({ message: 'Public registration completed' });
};

module.exports = { handlePublicWorkshopRegister };
