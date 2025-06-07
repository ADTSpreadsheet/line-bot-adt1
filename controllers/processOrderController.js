const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
require('dotenv').config();

// LINE Bot 1 Client (สำหรับส่งให้ User)
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const processOrder = async (req, res) => {
  try {
    const { ref_code, action, license_no, plan_type } = req.body;

    // ตรวจสอบข้อมูล
    if (!ref_code || !action) {
      return res.status(400).json({ message: 'ref_code และ action จำเป็น' });
    }

    // ตรวจสอบประเภท Plan
    const isPro = license_no ? true : false;
    const isStarter = plan_type === 'starter' ? true : false;

    if (!isPro && !isStarter) {
      return res.status(400).json({ message: 'ไม่สามารถระบุประเภท Plan ได้' });
    }

    const planName = isPro ? 'Professional' : 'Starter';
    console.log(`📥 รับคำสั่งจาก API2: ${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} - ${planName} Plan - ${ref_code}`);

    if (action === 'approve') {
      // กรณีอนุมัติ
      if (isPro) {
        await handleProApprovalProcess(ref_code, license_no);
      } else {
        await handleStarterApprovalProcess(ref_code);
      }
    } else if (action === 'reject') {
      // กรณีปฏิเสธ  
      if (isPro) {
        await handleProRejectionProcess(ref_code, license_no);
      } else {
        await handleStarterRejectionProcess(ref_code);
      }
    } else {
      return res.status(400).json({ message: 'action ต้องเป็น approve หรือ reject' });
    }

    // ✅ ตอบ 200 กลับไป API2
    return res.status(200).json({ 
      message: `${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} ${planName} Plan สำเร็จ`,
      ref_code,
      plan_type: planName.toLowerCase()
    });

  } catch (error) {
    console.error('❌ ประมวลผลล้มเหลว:', error);
    
    // ถ้าเป็น Duplicate Error ส่ง 400 แทน 500
    if (error.message.includes('ไปแล้ว')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message });
  }
};

// 🎯 ฟังก์ชันจัดการอนุมัติ Professional Plan
const handleProApprovalProcess = async (ref_code, license_no) => {
  try {
    console.log(`🔄 เริ่มประมวลผลอนุมัติ Pro Plan: ${ref_code}, ${license_no}`);

    // เช็คสถานะก่อนทำงาน
    const { data: existingSlip, error: checkError } = await supabase
      .from('slip_submissions')
      .select('submissions_status')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .single();

    if (checkError) throw checkError;

    // ถ้าอนุมัติไปแล้ว
    if (existingSlip?.submissions_status === 'Approved') {
      console.log('⚠️ ออเดอร์นี้อนุมัติไปแล้ว');
      throw new Error(`คุณได้ทำการอนุมัติ Ref.Code ${ref_code} ไปแล้ว`);
    }

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

    // Logic 3: ส่ง Flex Message ไปยังลูกค้า (Professional Plan)
    const flexMessage = {
      type: 'flex',
      altText: '🔔 แจ้งเตือนสถานะการสั่งซื้อของคุณ',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '🔔 แจ้งเตือนสถานะการสั่งซื้อของคุณ',
              weight: 'bold',
              size: 'lg',
              color: '#0099FF'
            },
            {
              type: 'text',
              text: '📋 ข้อมูลการสั่งซื้อ',
              weight: 'bold',
              margin: 'md'
            },
            {
              type: 'text',
              text: '📦 แพคเกจ: Professional-Plan',
              size: 'sm',
              margin: 'sm'
            },
            {
              type: 'text',
              text: '⏰ ระยะเวลาการใช้งาน: ไม่จำกัด',
              size: 'sm'
            },
            {
              type: 'text',
              text: `👤 Username: ${license_no}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `🔑 Password: ${serial_key}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: '✅ สามารถ Login เข้าใช้งานโปรแกรม ADTSpreadsheet ได้แล้วครับ',
              wrap: true,
              margin: 'md',
              color: '#28a745',
              weight: 'bold'
            }
          ]
        }
      }
    };

    await client.pushMessage(line_user_id, flexMessage);
    console.log(`✅ Logic 3: ส่ง Flex Message Pro Plan สำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleProApprovalProcess:', error);
    throw error;
  }
};

// 🎯 ฟังก์ชันจัดการอนุมัติ Starter Plan
const handleStarterApprovalProcess = async (ref_code) => {
  try {
    console.log(`🔄 เริ่มประมวลผลอนุมัติ Starter Plan: ${ref_code}`);

    // ดึงข้อมูลจาก starter_plan_users
    const { data: starterData, error: starterError } = await supabase
      .from('starter_plan_users')
      .select('submissions_status, username, password, duration_minutes, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (starterError || !starterData) {
      throw new Error('❌ ไม่พบข้อมูลใน starter_plan_users');
    }

    // เช็คสถานะ (แค่ตรวจสอบ ไม่อัพเดต)
    if (starterData.submissions_status === 'approved') {
      console.log('⚠️ ออเดอร์นี้อนุมัติไปแล้ว');
      throw new Error(`คุณได้ทำการอนุมัติ Ref.Code ${ref_code} ไปแล้ว`);
    }

    const { username, password, duration_minutes, line_user_id } = starterData;
    const durationDays = Math.floor(duration_minutes / 1440);

    // ส่ง Flex Message ไปยังลูกค้า (Starter Plan)
    const flexMessage = {
      type: 'flex',
      altText: '🔔 แจ้งเตือนสถานะการสั่งซื้อของคุณ',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '🔔 แจ้งเตือนสถานะการสั่งซื้อของคุณ',
              weight: 'bold',
              size: 'lg',
              color: '#0099FF'
            },
            {
              type: 'text',
              text: '📋 ข้อมูลการสั่งซื้อ',
              weight: 'bold',
              margin: 'md'
            },
            {
              type: 'text',
              text: '📦 แพคเกจ: Starter-Plan',
              size: 'sm',
              margin: 'sm'
            },
            {
              type: 'text',
              text: `⏰ ระยะเวลาการใช้งาน: ${durationDays} วัน`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `👤 Username: ${username}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: `🔑 Password: ${password}`,
              size: 'sm'
            },
            {
              type: 'text',
              text: '✅ สามารถ Login เข้าใช้งานโปรแกรม ADTSpreadsheet ได้แล้วครับ',
              wrap: true,
              margin: 'md',
              color: '#28a745',
              weight: 'bold'
            }
          ]
        }
      }
    };

    await client.pushMessage(line_user_id, flexMessage);
    console.log(`✅ ส่ง Flex Message Starter Plan สำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleStarterApprovalProcess:', error);
    throw error;
  }
};

// 🚫 ฟังก์ชันจัดการปฏิเสธ Professional Plan
const handleProRejectionProcess = async (ref_code, license_no) => {
  try {
    console.log(`🔄 เริ่มประมวลผลปฏิเสธ Pro Plan: ${ref_code}, ${license_no}`);

    // เช็คสถานะก่อนทำงาน
    const { data: existingSlip, error: checkError } = await supabase
      .from('slip_submissions')
      .select('submissions_status')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .single();

    if (checkError) throw checkError;

    // ถ้าปฏิเสธไปแล้ว
    if (existingSlip?.submissions_status === 'Rejected') {
      console.log('⚠️ ออเดอร์นี้ปฏิเสธไปแล้ว');
      throw new Error(`คุณได้ทำการปฏิเสธ Ref.Code ${ref_code} ไปแล้ว`);
    }

    // ถ้าอนุมัติไปแล้ว
    if (existingSlip?.submissions_status === 'Approved') {
      console.log('⚠️ ออเดอร์นี้อนุมัติไปแล้ว - ไม่สามารถปฏิเสธได้');
      throw new Error(`Ref.Code ${ref_code} ได้รับการอนุมัติไปแล้ว ไม่สามารถปฏิเสธได้`);
    }

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

    // ส่งข้อความปฏิเสธ
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: '❌ คำสั่งซื้อของคุณไม่ได้รับการอนุมัติ\n📞 กรุณาติดต่อฝ่ายขายหรือติดต่อ Tumcivil\n☎️ โทร : 089-499-0739'
    });

    console.log(`✅ ส่งข้อความปฏิเสธ Pro Plan สำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleProRejectionProcess:', error);
    throw error;
  }
};

// 🚫 ฟังก์ชันจัดการปฏิเสธ Starter Plan
const handleStarterRejectionProcess = async (ref_code) => {
  try {
    console.log(`🔄 เริ่มประมวลผลปฏิเสธ Starter Plan: ${ref_code}`);

    // ดึงข้อมูลจาก starter_plan_users
    const { data: starterData, error: starterError } = await supabase
      .from('starter_plan_users')
      .select('submissions_status, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (starterError || !starterData) {
      throw new Error('❌ ไม่พบข้อมูลใน starter_plan_users');
    }

    // เช็คสถานะ (แค่ตรวจสอบ)
    if (starterData.submissions_status === 'rejected') {
      console.log('⚠️ ออเดอร์นี้ปฏิเสธไปแล้ว');
      throw new Error(`คุณได้ทำการปฏิเสธ Ref.Code ${ref_code} ไปแล้ว`);
    }

    if (starterData.submissions_status === 'approved') {
      console.log('⚠️ ออเดอร์นี้อนุมัติไปแล้ว - ไม่สามารถปฏิเสธได้');
      throw new Error(`Ref.Code ${ref_code} ได้รับการอนุมัติไปแล้ว ไม่สามารถปฏิเสธได้`);
    }

    const { line_user_id } = starterData;

    // ส่งข้อความปฏิเสธ
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: '❌ คำสั่งซื้อของคุณไม่ได้รับการอนุมัติ\n📞 กรุณาติดต่อฝ่ายขายหรือติดต่อ Tumcivil\n☎️ โทร : 089-499-0739'
    });

    console.log(`✅ ส่งข้อความปฏิเสธ Starter Plan สำเร็จ → line_user_id: ${line_user_id}`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleStarterRejectionProcess:', error);
    throw error;
  }
};

module.exports = { processOrder };
