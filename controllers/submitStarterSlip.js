const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const runOCR = require('../utils/ocr/runOCR');
const extractInfoFromText = require('../utils/ocr/extractInfoFromText');
const axios = require('axios');
const line = require('@line/bot-sdk');

// LINE Bot Client
let client = null;
if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  client = new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
} else {
  console.warn('⚠️ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN - จะไม่สามารถส่ง Flex ได้');
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

    if (!ref_code || !first_name || !last_name || !national_id || !phone_number || !duration || !file_content) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ✅ 1. ตรวจ session
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code ในระบบ' });
    }

    const { serial_key, line_user_id } = sessionData;

    // ✅ 2. เช็คว่ามี record อยู่แล้วหรือยัง
    const { data: existingValidRecord, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('ref_code_status', 'valid')
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' });
    }

    if (existingValidRecord) {
      return res.status(409).json({ 
        message: 'มีการซื้อแพคเกจที่ยังใช้งานได้อยู่แล้ว',
        existing_order: existingValidRecord.order_number
      });
    }

    const duration_minutes = duration * 1440;
    const slipFileName = `SP-${ref_code}.jpg`;

    // ✅ 3. อัปโหลดภาพเข้า Supabase
    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code
    });

    if (uploadError) {
      return res.status(500).json({ message: 'อัปโหลดภาพไม่สำเร็จ', error: uploadError });
    }

    // ✅ 4. OCR & บันทึกลง starter_slip_ocr_logs
    try {
      const rawText = await runOCR(publicUrl);
      const parsed = extractInfoFromText(rawText);

      await supabase.from('starter_slip_ocr_logs').insert({
        ref_code,
        slip_path: publicUrl,
        raw_text: rawText,
        amount: parsed.amount,
        transfer_date: parsed.transferDate,
        transfer_time: parsed.transferTime,
        sender_name: parsed.senderName,
        status: 'pending'
      });

      console.log('🧾 OCR บันทึกลง starter_slip_ocr_logs เรียบร้อยแล้ว');

    } catch (ocrErr) {
      console.warn('⚠️ OCR failed:', ocrErr.message);
    }

    // ✅ 5. สร้าง order_number
    const { data: existingOrders, error: countError } = await supabase
      .from('starter_plan_users')
      .select('order_number')
      .eq('duration_minutes', duration_minutes)
      .not('order_number', 'is', null);

    const maxOrderNumber = existingOrders
      .filter(order => order.order_number?.startsWith(`${duration}D-`))
      .map(order => {
        const match = order.order_number.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);

    const sequentialNumber = maxOrderNumber + 1;
    const order_number = `${duration}D-${sequentialNumber.toString().padStart(4, '0')}`;
    const price_thb = Math.round((5500 / 15) * duration * 100) / 100;

    // ✅ 6. Insert ข้อมูลหลักลง starter_plan_users
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
          ref_code_status: 'pending',
          line_user_id,
          order_number,
          price_thb
        }
      ]);

    if (insertResult.error) {
      return res.status(500).json({ message: 'บันทึกข้อมูลไม่สำเร็จ', error: insertResult.error });
    }

    // ✅ 7. แจ้ง Bot2 (ถ้าต้องการ)
    try {
      const notifyRes = await axios.post(`${process.env.API2_URL}/starter/notify-admin-slip`, {
        ref_code,
        duration
      });

      if (notifyRes.status === 200) {
        return res.status(200).json({
          message: '✅ บันทึกข้อมูลสำเร็จ',
          data: {
            ref_code,
            duration,
            order_number,
            price_thb,
            status: 'pending_approval'
          }
        });
      } else {
        throw new Error(`Unexpected status: ${notifyRes.status}`);
      }

    } catch (notifyErr) {
      console.error('❌ แจ้ง Bot2 ไม่สำเร็จ:', notifyErr.message);
      return res.status(500).json({ message: 'บันทึกข้อมูลแล้ว แต่ไม่สามารถแจ้ง Bot2 ได้' });
    }

  } catch (err) {
    console.error('❌ submitStarterSlip ERROR:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ', error: err.message });
  }
}

module.exports = submitStarterSlip;
