// ✅ FILE: controllers/ConfirmRegistration.js

const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

/**
 * ✅ รองรับ JSON flat จาก Excel VBA
 * ✅ ใช้ ref_code เพื่อดึง line_user_id จาก Supabase
 * ✅ เก็บทั้ง line_user_id และ line_id
 */
const completeRegistration = async (req, res) => {
  try {
    const {
      ref_code,
      serial_key,
      machine_id,
      pdpa_status,
      gender,
      first_name,
      last_name,
      nickname,
      age,
      occupation,
      national_id,
      house_number,
      district,
      province,
      postal_code,
      phone_number,
      email,
      facebook_url,
      line_id // << ผู้ใช้กรอกเอง
    } = req.body;

    if (!ref_code || !serial_key || !machine_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ✅ ดึง line_user_id จาก Supabase โดยใช้ ref_code และ serial_key
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();

    if (error || !data || !data.line_user_id) {
      await supabase.from('activity_logs').insert({
        ref_code,
        line_user_id: null,
        line_id,
        action: `Ref.Code ${ref_code} ลงทะเบียนไม่สำเร็จ`,
        machine_id,
        pdpa_status,
        timestamp: new Date().toISOString()
      });

      try {
        if (line_id) {
          await client.pushMessage(line_id, {
            type: 'text',
            text: `❌ ไม่สามารถลงทะเบียนได้ โปรดติดต่อ Admin ของ ADT`
          });
        }
      } catch (lineError) {
        console.error('❌ Failed to notify user via LINE (fail case):', lineError);
      }

      return res.status(404).json({ success: false, message: 'Invalid Ref.Code or Serial Key' });
    }

    const line_user_id = data.line_user_id;

    const usageDays = pdpa_status === 'ACCEPTED' ? 7 : 1;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + usageDays);

    const user_data = {
      gender,
      first_name,
      last_name,
      nickname,
      age,
      occupation,
      national_id,
      house_number,
      district,
      province,
      postal_code,
      phone_number,
      email,
      facebook_url,
      line_id // ✅ บันทึกไว้ด้วย (ลูกค้ากรอก)
    };

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        machine_id,
        pdpa_status,
        user_data,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      })
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key);

    if (updateError) {
      await supabase.from('activity_logs').insert({
        ref_code,
        line_user_id,
        line_id,
        action: `Ref.Code ${ref_code} บันทึกไม่สำเร็จ`,
        machine_id,
        pdpa_status,
        timestamp: new Date().toISOString()
      });

      try {
        await client.pushMessage(line_user_id, {
          type: 'text',
          text: `❌ ไม่สามารถบันทึกข้อมูลลงทะเบียนได้ โปรดติดต่อ Admin ของ ADT`
        });
      } catch (lineError) {
        console.error('❌ Failed to notify user via LINE (save fail):', lineError);
      }

      return res.status(500).json({ success: false, message: 'Failed to save registration data' });
    }

    const logMessage = pdpa_status === 'ACCEPTED'
      ? `Ref.Code ${ref_code} ลงทะเบียนใช้ ADTSpreadsheet ได้ฟรี 7 วัน สำเร็จ`
      : `Ref.Code ${ref_code} ลงทะเบียนใช้ ADTSpreadsheet ได้ฟรี 1 วัน สำเร็จ`;

    await supabase.from('activity_logs').insert({
      ref_code,
      line_user_id,
      line_id,
      action: logMessage,
      machine_id,
      pdpa_status,
      timestamp: new Date().toISOString()
    });

    try {
      await client.pushMessage(line_user_id, {
        type: 'text',
        text: `🎉 คุณลงทะเบียนสำเร็จ! ได้รับสิทธิ์ใช้งาน ADTSpreadsheet เวอร์ชั่นทดลองใช้ฟรี ${usageDays} วัน\nหมดอายุวันที่ ${expiryDate.toLocaleDateString('th-TH')} ครับ`
      });
    } catch (err) {
      console.error('⚠️ Failed to send LINE message:', err);
    }

    return res.status(200).json({
      success: true,
      message: 'Registration completed successfully',
      expiryDate: expiryDate.toISOString(),
      usageDays
    });
  } catch (err) {
    console.error('❌ Server error in completeRegistration:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  completeRegistration
};
