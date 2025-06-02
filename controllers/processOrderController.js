const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
require('dotenv').config();

// LINE Bot 1 Client (สำหรับส่งให้ User)
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const processOrder = async (req, res) => {
  try {
    const { ref_code, license_no, status } = req.body;

    // ตรวจสอบข้อมูล
    if (!ref_code || !license_no || !status) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    console.log(`📥 รับคำสั่งจาก API2: ${status === 'Ap' ? 'อนุมัติ' : 'ปฏิเสธ'} - ${ref_code}`);

    if (status === 'Ap') {
      // กรณีอนุมัติ
      await handleApprovalProcess(ref_code, license_no);
    } else {
      // กรณีปฏิเสธ  
      await handleRejectionProcess(ref_code, license_no);
    }

    // ✅ ตอบ 200 กลับไป API2
    return res.status(200).json({ 
      message: `${status === 'Ap' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ`,
      ref_code,
      license_no
    });

  } catch (error) {
    console.error('❌ ประมวลผลล้มเหลว:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ฟังก์ชันจัดการอนุมัติ
const handleApprovalProcess = async (ref_code, license_no) => {
  // อัปเดตสถานะเป็น approved
  // ดึงข้อมูล line_user_id และ serial_key
  // ส่ง Flex ไปหา User
  // อัปเดต username/password
};

// ฟังก์ชันจัดการปฏิเสธ
const handleRejectionProcess = async (ref_code, license_no) => {
  // อัปเดตสถานะเป็น rejected
  // ส่ง Flex แจ้งปฏิเสธไปหา User
};

module.exports = { processOrder };
