const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const handleSubmitLiveWorkshop = async (req, res) => {
  const {
    ref_code,
    serial_key,
    first_name,
    last_name,
    phone_number,
    has_adt,
    license_no,
    adt_class_no
  } = req.body;

  // 🔎 Logic 1: ตรวจสอบความครบของข้อมูล
  if (!ref_code || !serial_key || !first_name || !last_name || !phone_number || !has_adt || !adt_class_no) {
    return res.status(400).json({ error: 'กรอกข้อมูลไม่ครบ กรุณาลองใหม่อีกครั้ง' });
  }

  // 🔎 Logic 2: ตรวจสอบ ref_code + serial_key
  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('line_user_id')
    .eq('ref_code', ref_code)
    .eq('serial_key', serial_key)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return res.status(403).json({ error: 'Ref.Code หรือ Serial Key ไม่ถูกต้อง' });
  }

  const { line_user_id } = sessionData;

  // 🧠 กำหนด student_status ตามเงื่อนไข
  const student_status = has_adt === 'yes' ? license_no : 'attendees';

  // 🛠️ อัปเดต source ใน auth_sessions
  await supabase
    .from('auth_sessions')
    .update({ source: student_status })
    .eq('ref_code', ref_code);

  // 💾 Insert ลง adt_workshop_attendees
  const { error: insertError } = await supabase
    .from('adt_workshop_attendees')
    .insert({
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status,
      has_adt,
      license_no: has_adt === 'yes' ? license_no : null,
      adt_class_no,
      second_session_status: 'pending'
    });

  if (insertError) {
    return res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
  }

  // 📨 Logic 2.2: ส่ง Flex Message
  const flexMsg = {
    type: 'flex',
    altText: '✅ ข้อมูลยืนยันเสร็จสิ้น - เข้าห้องเรียน ADT Workshop',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://wpxpukbvynxawfxcdroj.supabase.co/storage/v1/object/public/adtliveworkshop//Live02.jpg',
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
            text: '🎉 ยืนยันสิทธิ์เรียบร้อยแล้ว',
            weight: 'bold',
            size: 'lg',
            color: '#1DB446'
          },
          {
            type: 'text',
            text: '📌 เตรียมเข้าห้องเรียน ADTLive Workshop',
            size: 'sm',
            margin: 'md'
          },
          {
            type: 'text',
            text: '🔐 รหัสห้อง: ADT0531',
            size: 'sm',
            margin: 'md',
            color: '#555555'
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
              label: '📥 เข้าห้องเรียน Zoom',
              uri: 'https://us06web.zoom.us/j/87599526391?pwd=U0wdvFqGbHaaLrlkEWbO7fRbaHqNw9.1'
            }
          }
        ]
      }
    }
  };

  try {
    await client.pushMessage(line_user_id, flexMsg);

    // ส่งข้อความย้ำเวลาเรียน
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: '🕖 เตรียมตัวให้พร้อมนะครับ\nคลาสสดจะเริ่มในวันที่ 31 พ.ค. 2568 เวลา 19:00 น. ผ่าน Zoom ครับ'
    });
  } catch (err) {
    console.error('❌ Error sending Flex:', err.message);
    return res.status(200).json({ message: 'ลงทะเบียนสำเร็จ แต่ส่ง LINE ไม่สำเร็จ' });
  }

  // 🎯 Logic 3: ตอบกลับ 200 กลับเว็บ
  return res.status(200).json({ message: 'ลงทะเบียนเรียบร้อย และส่ง Flex สำเร็จ' });
};

module.exports = { handleSubmitLiveWorkshop };
