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
  try {
    console.log(`🔄 เริ่มประมวลผลอนุมัติ: ${ref_code}, ${license_no}`);

    // Logic 1: อัปเดตสถานะใน slip_submissions เป็น 'Approved'
    const { error: updateSlipError } = await supabase
      .from('slip_submissions')
      .update({ submissions_status: 'Approved' })
      .eq('ref_code', ref_code)
      .eq('license_no', license_no);

    if (updateSlipError) throw updateSlipError;
    console.log('✅ Logic 1: อัปเดตสถานะ slip_submissions แล้ว');

    // ดึง serial_key จาก auth_sessions สำหรับ Logic 2
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, serial_key')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      throw new Error('❌ ไม่พบข้อมูลใน auth_sessions');
    }

    const { line_user_id, serial_key } = sessionData;

    // Logic 2: อัปเดต username และ password ใน license_holders
    const { error: updateLicenseError } = await supabase
      .from('license_holders')
      .update({
        username: license_no,  // username = license_no
        password: serial_key   // password = serial_key จาก auth_sessions
      })
      .eq('license_no', license_no);

    if (updateLicenseError) throw updateLicenseError;
    console.log('✅ Logic 2: อัปเดต username/password ใน license_holders แล้ว');

    // Logic 3: ส่ง Flex Message ไปยังลูกค้า
    const flexMessage = {
      type: 'flex',
      altText: '🎉 แจ้งเตือนการอนุมัติคำสั่งซื้อ ADTSpreadsheet',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{
            type: 'text',
            text: '🎉 แจ้งเตือนสถานะการสั่งซื้อ',
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
              text: '✅ คำสั่งซื้อของท่านได้รับการอนุมัติแล้ว',
              wrap: true,
              weight: 'bold',
              color: '#28a745'
            },
            {
              type: 'text',
              text: '📄 รายละเอียดลิขสิทธิ์ของท่านคือ',
              wrap: true,
              margin: 'md'
            },
            {
              type: 'text',
              text: `🆔 License no : ${license_no}`,
              weight: 'bold',
              size: 'sm',
              margin: 'sm'
            },
            {
              type: 'text',
              text: `🔖 Ref.Code : ${ref_code}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `👤 Username : ${license_no}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `🔑 Password : ${serial_key}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: '💻 ท่านสามารถนำข้อมูลไปทำการ login ที่หน้าโปรแกรม ADTSpreadsheet ได้เลยครับ',
              wrap: true,
              margin: 'md',
              color: '#666666'
            }
          ]
        }
      }
    };

    await client.pushMessage(line_user_id, flexMessage);
    console.log(`✅ Logic 3: ส่ง Flex Message สำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleApprovalProcess:', error);
    throw error;
  }
};

// ฟังก์ชันจัดการปฏิเสธ
const handleRejectionProcess = async (ref_code, license_no) => {
  try {
    console.log(`🔄 เริ่มประมวลผลปฏิเสธ: ${ref_code}, ${license_no}`);

    // Logic 1: อัปเดตสถานะใน slip_submissions เป็น 'Rejected'
    const { error: updateSlipError } = await supabase
      .from('slip_submissions')
      .update({ submissions_status: 'Rejected' })
      .eq('ref_code', ref_code)
      .eq('license_no', license_no);

    if (updateSlipError) throw updateSlipError;
    console.log('✅ Logic 1: อัปเดตสถานะ slip_submissions เป็น Rejected แล้ว');

    // ดึง line_user_id จาก auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      throw new Error('❌ ไม่พบข้อมูลใน auth_sessions');
    }

    const { line_user_id } = sessionData;

    // ส่ง Flex Message แจ้งปฏิเสธไปยังลูกค้า
    const flexMessage = {
      type: 'flex',
      altText: '❌ แจ้งเตือนการปฏิเสธคำสั่งซื้อ ADTSpreadsheet',
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
            color: '#FF5551'
          }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '❌ คำสั่งซื้อของท่านถูกปฏิเสธ',
              wrap: true,
              weight: 'bold',
              color: '#dc3545'
            },
            {
              type: 'text',
              text: `🆔 License no : ${license_no}`,
              weight: 'bold',
              size: 'sm',
              margin: 'md'
            },
            {
              type: 'text',
              text: `🔖 Ref.Code : ${ref_code}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: '📞 กรุณาติดต่อ Admin ฝ่ายขายหรือติดต่อ TumCivil',
              wrap: true,
              margin: 'md',
              weight: 'bold'
            },
            {
              type: 'text',
              text: '☎️ โทร : 089-499-0739',
              size: 'sm',
              weight: 'bold',
              color: '#0099FF'
            }
          ]
        }
      }
    };

    await client.pushMessage(line_user_id, flexMessage);
    console.log(`✅ ส่ง Flex Message ปฏิเสธสำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleRejectionProcess:', error);
    throw error;
  }
};

module.exports = { processOrder };
