// controllers/OrderApproved.js

const axios = require('axios');
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

require('dotenv').config();

// LINE Bot 1 Client
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const handleOrderApproved = async (req, res) => {
  try {
    const { ref_code, license_no } = req.body;

    if (!ref_code || !license_no) {
      return res.status(400).json({ message: 'กรุณาระบุ ref_code และ license_no' });
    }

    console.log(`📥 รับคำสั่งอนุมัติ: ref_code = ${ref_code}, license_no = ${license_no}`);

    // 1️⃣ อัปเดตสถานะ slip_submissions เป็น Approved
    const { error: updateSlipError } = await supabase
      .from('slip_submissions')
      .update({ submissions_status: 'approved' })
      .eq('ref_code', ref_code)
      .eq('license_no', license_no);

    if (updateSlipError) throw updateSlipError;
    console.log('✅ อัปเดตสถานะ slip_submissions แล้ว');

    // 2️⃣ ดึง line_user_id และ serial_key จาก auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, serial_key')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      throw new Error('❌ ไม่พบข้อมูลใน auth_sessions');
    }

    const { line_user_id, serial_key } = sessionData;

    // 3️⃣ ส่ง Flex Message ไปยังลูกค้า
    const message = {
      type: 'flex',
      altText: 'แจ้งเตือนการอนุมัติคำสั่งซื้อ ADTSpreadsheet',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{
            type: 'text',
            text: '📢 แจ้งเตือนสถานะการสั่งซื้อ',
            weight: 'bold',
            size: 'lg',
            color: '#0099FF'
          }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: 'คำสั่งซื้อของท่านได้รับการอนุมัติแล้ว',
              wrap: true
            },
            {
              type: 'text',
              text: 'รายละเอียดลิขสิทธิ์ของท่านคือ:',
              wrap: true
            },
            {
              type: 'text',
              text: `License no : ${license_no}`,
              weight: 'bold',
              size: 'sm'
            },
            {
              type: 'text',
              text: `Ref.Code : ${ref_code}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `Username : ${license_no}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `Password : ${serial_key}`,
              size: 'sm'
            }
          ]
        }
      }
    };

    await client.pushMessage(line_user_id, message);
    console.log(`✅ ส่งข้อความแจ้งลูกค้าสำเร็จ → line_user_id: ${line_user_id}`);

    // 4️⃣ อัปเดต license_holders → username = license_no, password = serial_key
    const { error: updateLicenseError } = await supabase
      .from('license_holders')
      .update({
        username: license_no,
        password: serial_key
      })
      .eq('license_no', license_no);

    if (updateLicenseError) throw updateLicenseError;
    console.log('✅ อัปเดต username / password สำเร็จใน license_holders');

    return res.status(200).json({ message: '✅ ดำเนินการอนุมัติสำเร็จ' });

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน OrderApproved:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = handleOrderApproved;
