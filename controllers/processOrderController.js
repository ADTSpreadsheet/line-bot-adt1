const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
require('dotenv').config();

// LINE Bot 1 Client (สำหรับส่งให้ User)
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// 🎨 ฟังก์ชันสร้าง Flex Message หลังดำเนินการเสร็จ (สำหรับ Admin)
const createUpdatedAdminFlex = (userData, ref_code, action, actionData = {}) => {
  const { first_name, last_name, order_number } = userData;
  const full_name = `${first_name} ${last_name}`;
  const isApproved = action === 'approved';
  const actionText = isApproved ? 'อนุมัติ' : 'ปฏิเสธ';
  const statusColor = isApproved ? '#28a745' : '#dc3545';
  const statusIcon = isApproved ? '✅' : '❌';

  return {
    type: "flex",
    altText: `${actionText}คำสั่งซื้อ ${full_name} แล้ว`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${statusIcon} Starter Plan no. ${order_number || 'N/A'}`,
            size: "md",
            weight: "bold",
            color: statusColor
          }
        ],
        backgroundColor: "#F8F9FA",
        paddingAll: "sm"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          { type: "text", text: `🔢 Ref.Code: ${ref_code}`, size: "sm", weight: "bold", color: "#007BFF" },
          { type: "text", text: `👤 ชื่อ: ${full_name}`, size: "sm" },
          { type: "text", text: `📱 เบอร์: ${userData.phone_number || 'N/A'}`, size: "sm" },
          { type: "text", text: `🆔 เลขบัตร: ${userData.national_id || 'N/A'}`, size: "sm" },
          { type: "text", text: `⏰ ระยะเวลา: ${actionData.duration || 'N/A'} วัน`, size: "sm" },
          { type: "text", text: `💰 ราคาแพคเกจ: ${userData.price_thb || 'N/A'} บาท`, size: "sm" }
        ],
        paddingAll: "sm"
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          // แสดงสถานะการดำเนินการ
          {
            type: 'text',
            text: `${statusIcon} ${actionText}คำสั่งซื้อนี้แล้ว`,
            weight: 'bold',
            color: statusColor,
            align: 'center',
            size: 'md',
            margin: 'md'
          },
          {
            type: 'text',
            text: `${actionText}เมื่อ: ${new Date().toLocaleString('th-TH')}`,
            size: 'xs',
            color: '#666666',
            align: 'center',
            margin: 'sm'
          },
          // ปุ่มดูสลิป (ถ้ามี)
          ...(userData.slip_image_url ? [{
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: '📄 ดูสลิป',
              uri: userData.slip_image_url
            },
            height: "sm",
            margin: "md"
          }] : [])
        ],
        paddingAll: "sm"
      }
    }
  };
};

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
      .select('*')
      .eq('ref_code', ref_code)
      .eq('submissions_status', 'pending')
      .single();

    if (starterError || !starterData) {
      throw new Error('❌ ไม่พบข้อมูลใน starter_plan_users');
    }

    // เช็คสถานะ (แค่ตรวจสอบ ไม่อัพเดต)
    if (starterData.submissions_status === 'approved') {
      console.log('⚠️ ออเดอร์นี้อนุมัติไปแล้ว');
      throw new Error(`คุณได้ทำการอนุมัติ Ref.Code ${ref_code} ไปแล้ว`);
    }

    const { duration_minutes, line_user_id } = starterData;
    const durationDays = Math.floor(duration_minutes / 1440);

    // ดึง serial_key จาก auth_sessions สำหรับสร้าง password
    const { data: authData, error: authError } = await supabase
      .from('auth_sessions')
      .select('serial_key')
      .eq('ref_code', ref_code)
      .single();

    if (authError || !authData) {
      throw new Error('❌ ไม่พบข้อมูล serial_key ใน auth_sessions');
    }

    // สร้าง username และ password
    const username = `ADT-${durationDays}D-${ref_code}`;
    const password = authData.serial_key;

    console.log('🔑 สร้าง Username/Password:', { username, password });

    // อัพเดทสถานะ พร้อม username/password
    const { error: updateError } = await supabase
      .from('starter_plan_users')
      .update({ 
        submissions_status: 'approved',
        username: username,
        password: password
      })
      .eq('ref_code', ref_code);

    if (updateError) throw updateError;
    console.log('✅ อัพเดทสถานะ starter_plan_users สำเร็จ');

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

    // 🎨 แก้ไข Flex Message ของ Admin
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('starter_plan_users')
        .select('admin_message_id, first_name, last_name, order_number, phone_number, national_id, price_thb, slip_image_url')
        .eq('ref_code', ref_code)
        .single();

      if (msgError) {
        console.log('⚠️ ไม่สามารถดึง admin_message_id ได้:', msgError);
      } else if (msgData?.admin_message_id) {
        const updatedFlex = createUpdatedAdminFlex(msgData, ref_code, 'approved', { duration: durationDays });
        
        // สร้าง LINE Client สำหรับ Bot2 (Admin)
        const adminClient = new line.Client({
          channelAccessToken: process.env.LINE_BOT2_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN
        });
        
        await adminClient.editMessage(msgData.admin_message_id, updatedFlex);
        console.log('✅ แก้ไข Flex Message ของ Admin สำเร็จ');
      }
    } catch (editError) {
      console.log('⚠️ ไม่สามารถแก้ไข Flex Message ของ Admin ได้:', editError.message);
      // ไม่ throw error เพราะการส่งข้อความหลักสำเร็จแล้ว
    }

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
      .select('*')
      .eq('ref_code', ref_code)
      .eq('submissions_status', 'pending')
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

    const { line_user_id, duration_minutes } = starterData;
    const durationDays = Math.floor(duration_minutes / 1440);

    // อัพเดทสถานะ
    const { error: updateError } = await supabase
      .from('starter_plan_users')
      .update({ 
        submissions_status: 'rejected'
      })
      .eq('ref_code', ref_code);

    if (updateError) throw updateError;
    console.log('✅ อัพเดทสถานะ starter_plan_users เป็น rejected สำเร็จ');

    // ส่งข้อความปฏิเสธ
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: '❌ คำสั่งซื้อของคุณไม่ได้รับการอนุมัติ\n📞 กรุณาติดต่อฝ่ายขายหรือติดต่อ Tumcivil\n☎️ โทร : 089-499-0739'
    });

    console.log(`✅ ส่งข้อความปฏิเสธ Starter Plan สำเร็จ → line_user_id: ${line_user_id}`);

    // 🎨 แก้ไข Flex Message ของ Admin
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('starter_plan_users')
        .select('admin_message_id, first_name, last_name, order_number, phone_number, national_id, price_thb, slip_image_url')
        .eq('ref_code', ref_code)
        .single();

      if (msgError) {
        console.log('⚠️ ไม่สามารถดึง admin_message_id ได้:', msgError);
      } else if (msgData?.admin_message_id) {
        const updatedFlex = createUpdatedAdminFlex(msgData, ref_code, 'rejected', { duration: durationDays });
        
        // สร้าง LINE Client สำหรับ Bot2 (Admin)
        const adminClient = new line.Client({
          channelAccessToken: process.env.LINE_BOT2_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN
        });
        
        await adminClient.editMessage(msgData.admin_message_id, updatedFlex);
        console.log('✅ แก้ไข Flex Message ของ Admin สำเร็จ');
      }
    } catch (editError) {
      console.log('⚠️ ไม่สามารถแก้ไข Flex Message ของ Admin ได้:', editError.message);
      // ไม่ throw error เพราะการส่งข้อความหลักสำเร็จแล้ว
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน handleStarterRejectionProcess:', error);
    throw error;
  }
};

module.exports = { processOrder };
