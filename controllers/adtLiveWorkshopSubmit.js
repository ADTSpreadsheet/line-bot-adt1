const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const handleSubmitLiveWorkshop = async (req, res) => {
  const { license_no, ref_code, serial_key } = req.body;

  if (!license_no || !ref_code || !serial_key) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const { data: licenseData, error: licenseError } = await supabase
    .from('license_holders')
    .select('first_name, last_name')
    .eq('license_no', license_no)
    .maybeSingle();

  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('line_user_id, phone_number')
    .eq('ref_code', ref_code)
    .eq('serial_key', serial_key)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return res.status(403).json({ error: 'Ref.Code or Serial Key not found.' });
  }

  const { line_user_id, phone_number } = sessionData;
  const first_name = licenseData?.first_name || '';
  const last_name = licenseData?.last_name || '';

  const newSource = 'adt_workshop_attendee';
  await supabase
    .from('auth_sessions')
    .update({ source: newSource })
    .eq('ref_code', ref_code);

  const student_status = licenseData ? license_no : newSource;

  const { error: insertError } = await supabase
    .from('adt_workshop_attendees')
    .insert({
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status
    });

  if (insertError) {
    return res.status(500).json({ error: 'Failed to save workshop registration.' });
  }

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
      text: '📌 ตอนนี้พี่ได้เข้าห้องเรียนเป็นที่เรียบร้อยแล้ว\nเดี๋ยว อ.เก่ง จะทำการเปิดห้องเรียนในเวลา 24 พ.ค. 2568 เวลา 19:00 น. นะครับ 🕖'
    });

  } catch (err) {
    console.error('❌ Error sending Flex or message:', err.message);
    return res.status(200).json({ message: 'Registered, but failed to send LINE message.' });
  }

  return res.status(200).json({ message: 'Registration completed and Flex sent.' });
};

module.exports = { handleSubmitLiveWorkshop };
