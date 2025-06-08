const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');
const line = require('@line/bot-sdk');
const runOCR = require('../utils/ocr/runOCR');
const extractInfoFromText = require('../utils/ocr/extractInfoFromText');

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

    const { data: existingValidRecord, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('ref_code_status', 'valid')
      .maybeSingle();

    if (checkError) {
      console.error('❌ เช็ค existing record ไม่สำเร็จ:', checkError);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' });
    }

    if (existingValidRecord) {
      return res.status(409).json({
        message: 'มีการซื้อแพคเกจที่ยังใช้งานได้อยู่แล้ว',
        existing_order: existingValidRecord.order_number,
        remaining_minutes: existingValidRecord.remaining_minutes
      });
    }

    const duration_minutes = duration * 1440;
    const slipFileName = `SP-${ref_code}.jpg`;

    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code
    });

    if (uploadError) {
      return res.status(500).json({ message: 'อัปโหลดภาพไม่สำเร็จ', error: uploadError });
    }

    // ✅ OCR STEP
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

      console.log('📄 OCR log saved for ref_code:', ref_code);
    } catch (ocrError) {
      console.warn('⚠️ OCR failed or partial:', ocrError.message);
    }

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

    let response;
    try {
      response = await axios.post(`${process.env.API2_URL}/starter/notify-admin-slip`, {
        ref_code,
        duration
      }, {
        timeout: 10000
      });
    } catch (apiError) {
      return res.status(500).json({
        message: 'ไม่สามารถแจ้งเตือนแอดมินได้',
        error: apiError.message
      });
    }

    if (response.status === 200) {
      return res.status(200).json({
        message: '✅ บันทึกข้อมูลและแจ้งเตือน Admin สำเร็จ รอการอนุมัติ',
        data: {
          ref_code,
          duration,
          order_number,
          price_thb,
          status: 'pending_approval'
        }
      });
    } else {
      return res.status(500).json({
        message: '❌ ไม่สามารถแจ้งเตือน Admin ได้',
        status: response.status,
        data: response.data
      });
    }

  } catch (err) {
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในระบบ',
      error: err.message
    });
  }
}

module.exports = submitStarterSlip;
