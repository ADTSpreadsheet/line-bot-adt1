const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');

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
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 🔎 ตรวจสอบ session
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ref_code not found' });
    }

    const { serial_key, line_user_id } = sessionData;

    // 🔁 ตรวจสอบว่ามี record ที่ยัง active อยู่แล้วหรือยัง
    const { data: existingValidRecord, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('ref_code_status', 'valid')
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ message: 'Failed to check existing record' });
    }

    if (existingValidRecord) {
      return res.status(409).json({ 
        message: 'Valid plan already exists',
        existing_order: existingValidRecord.order_number
      });
    }

    const duration_minutes = duration * 1440;
    const slipFileName = `SP-${ref_code}.jpg`;

    // 🖼️ Upload สลิป
    const { publicUrl, error: uploadError } = await uploadBase64Image({
      base64String: file_content,
      fileName: slipFileName,
      bucketName: 'statercustumer',
      folderName: ref_code
    });

    if (uploadError) {
      return res.status(500).json({ message: 'Image upload failed', error: uploadError });
    }

    // 🧮 Gen order_number
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

    // ✅ Insert ข้อมูลเข้า starter_plan_users
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
      return res.status(500).json({ message: 'Failed to insert user', error: insertResult.error });
    }

    // 🔔 แจ้ง Bot2
    try {
      const notifyRes = await axios.post(`${process.env.API2_URL}/starter/notify-admin-slip`, {
        ref_code,
        duration
      });

      if (notifyRes.status === 200) {
        return res.status(200).json({
          message: '✅ Submitted successfully',
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
      console.error('❌ Notify Bot2 failed:', notifyErr.message);
      return res.status(500).json({ message: 'Saved, but failed to notify Bot2' });
    }

  } catch (err) {
    console.error('❌ submitStarterSlip ERROR:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

module.exports = submitStarterSlip;
