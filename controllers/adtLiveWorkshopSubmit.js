const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const zoomInviteLink = 'https://us06web.zoom.us/j/87599526391?pwd=U0wdvFqGbHaaLrlkEWbO7fRbaHqNw9.1';
const zoomPassword = 'ADT0531';

const handleSubmitLiveWorkshop = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone_number,
      ref_code,
      serial_key,
      has_adt,
      student_status,
      line_user_id
    } = req.body;

    // Trim เพื่อกันเว้นวรรค
    const trimmedFirstName = first_name?.trim();
    const trimmedLastName = last_name?.trim();
    const trimmedPhone = phone_number?.trim();
    const trimmedRefCode = ref_code?.trim();
    const trimmedSerialKey = serial_key?.trim();

    if (
      !trimmedFirstName ||
      !trimmedLastName ||
      !trimmedPhone ||
      !trimmedRefCode ||
      !trimmedSerialKey
    ) {
      return res.status(400).json({
        message: "❌ ไม่สามารถลงทะเบียนได้: กรอกข้อมูลไม่ครบ กรุณาลองใหม่อีกครั้ง"
      });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('adt_workshop_attendees')
      .select('id')
      .eq('ref_code', trimmedRefCode)
      .single();

    let resultMessage = '';
    if (existing) {
      const { error: updateError } = await supabase
        .from('adt_workshop_attendees')
        .update({ adt_class_no: 'ADTLive[02]' })
        .eq('ref_code', trimmedRefCode);

      if (updateError) {
        return res.status(500).json({ message: "❌ ไม่สามารถอัปเดตคลาสได้", error: updateError });
      }
      resultMessage = "🎉 อัปเดตคลาสเรียนเป็น ADTLive[02] แล้ว!";
    } else {
      const { error: insertError } = await supabase
        .from('adt_workshop_attendees')
        .insert([
          {
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            phone_number: trimmedPhone,
            ref_code: trimmedRefCode,
            serial_key: trimmedSerialKey,
            has_adt: has_adt || null,
            student_status: student_status || 'attendees',
            adt_class_no: 'ADTLive[02]',
            line_user_id: line_user_id || null
          }
        ]);

      if (insertError) {
        return res.status(500).json({ message: "❌ ไม่สามารถลงทะเบียนใหม่ได้", error: insertError });
      }
      resultMessage = "✅ ลงทะเบียนสำเร็จ ADTLive[02]!";
    }

    // ✅ ส่ง Flex Message ไปยัง LINE
    if (line_user_id) {
      await client.pushMessage(line_user_id, {
        type: "flex",
        altText: "ลงทะเบียน ADTLive[02] สำเร็จแล้ว!",
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: "https://example.com/workshop-poster.jpg",
            size: "full",
            aspectRatio: "16:9",
            aspectMode: "cover"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🎉 ยินดีต้อนรับเข้าสู่ ADTLive Workshop",
                weight: "bold",
                size: "md",
                wrap: true
              },
              {
                type: "text",
                text: `ห้องเรียน Zoom`,
                margin: "md",
                size: "sm"
              },
              {
                type: "text",
                text: `🔗 ${zoomInviteLink}`,
                size: "xs",
                color: "#0066CC",
                wrap: true
              },
              {
                type: "text",
                text: `รหัสผ่าน: ${zoomPassword}`,
                size: "xs",
                margin: "sm"
              }
            ]
          }
        }
      });
    }

    return res.status(200).json({ message: resultMessage });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดไม่ทราบสาเหตุ", error: err });
  }
};

module.exports = { handleSubmitLiveWorkshop };
