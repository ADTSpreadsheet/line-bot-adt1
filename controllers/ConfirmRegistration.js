// controllers/ConfirmRegistration.js
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

// LINE Bot configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

/**
 * ตรวจสอบ Ref.Code และส่ง Serial Key ไปทางไลน์
 * เมื่อผู้ใช้กดปุ่ม "Verify Code" ใน Userform3
 */
const verifyRefCode = async (req, res) => {
  try {
    const { refCode } = req.body;
    
    if (!refCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing Ref.Code' 
      });
    }
    
    // ตรวจสอบว่า Ref.Code มีอยู่ในระบบหรือไม่
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id, serial_key')
      .eq('ref_code', refCode)
      .single();
      
    if (error || !data) {
      console.error('❌ Error verifying Ref.Code:', error || 'Not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid Ref.Code' 
      });
    }
    
    // ส่ง Serial Key ไปที่ไลน์
    try {
      await client.pushMessage(data.line_user_id, {
        type: 'text',
        text: `✅ รหัส Serial Key ของคุณคือ: ${data.serial_key}\nโปรดป้อนรหัสนี้ในช่อง Excel ของคุณเพื่อเปิดใช้งาน\nรหัสนี้จะหมดอายุใน 5 นาที`
      });
      
      // อัปเดตสถานะ
      await supabase
        .from('auth_sessions')
        .update({ 
          status: 'REFCODE_VERIFIED',
          last_action_at: new Date().toISOString()
        })
        .eq('ref_code', refCode);
        
      // ส่งผลลัพธ์กลับไป VBA
      return res.status(200).json({
        success: true,
        message: 'Serial Key sent successfully',
        countdown: "Serial Key จะหมดอายุใน: 5:00 นาที",
        stage3: "Serial Key ได้ถูกส่งไปยังแชทไลน์ของคุณแล้ว กรุณาตรวจสอบและนำมากรอก"
      });
      
    } catch (lineError) {
      console.error('❌ Error sending Serial Key to LINE:', lineError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send Serial Key' 
      });
    }
    
  } catch (error) {
    console.error('❌ Error in verifyRefCode:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * ตรวจสอบ Serial Key และ Ref.Code
 * เมื่อผู้ใช้กดปุ่ม "Confirm" ใน Userform3
 */
const verifySerialKey = async (req, res) => {
  try {
    const { refCode, serialKey } = req.body;
    
    if (!refCode || !serialKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing Ref.Code or Serial Key' 
      });
    }
    
    // ตรวจสอบว่า Serial Key ตรงกับ Ref.Code หรือไม่
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status')
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey)
      .single();
      
    if (error || !data) {
      console.error('❌ Error verifying Serial Key:', error || 'Not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid Serial Key or Ref.Code' 
      });
    }
    
    // อัปเดตสถานะ
    await supabase
      .from('auth_sessions')
      .update({ 
        status: 'SERIALKEY_VERIFIED',
        verified_at: new Date().toISOString()
      })
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey);
    
    // ส่งผลลัพธ์กลับไป VBA
    return res.status(200).json({ 
      success: true, 
      message: 'Serial Key verified successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in verifySerialKey:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * บันทึกข้อมูลการลงทะเบียนทั้งหมด
 * เมื่อ VBA เรียกใช้ฟังก์ชัน ConfirmRegistration()
 */
const completeRegistration = async (req, res) => {
  try {
    const { 
      refCode, 
      serialKey, 
      machineId, 
      pdpaStatus, // ACCEPTED หรือ NOT_ACCEPTED
      userData     // ข้อมูลจากฟอร์ม REGISTER
    } = req.body;
    
    if (!refCode || !serialKey || !machineId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // ตรวจสอบสถานะก่อนบันทึกข้อมูล
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status')
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey)
      .single();
      
    if (error || !data) {
      console.error('❌ Error fetching session data:', error || 'Not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid Ref.Code or Serial Key' 
      });
    }
    
    // กำหนดระยะเวลาการใช้งานตามสถานะ PDPA
    const usageDays = pdpaStatus === 'ACCEPTED' ? 7 : 1;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + usageDays);
    
    // บันทึกข้อมูลทั้งหมด
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        machine_id: machineId,
        pdpa_status: pdpaStatus,
        user_data: userData, // ข้อมูลทั้งหมดจากฟอร์ม REGISTER
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      })
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey);
      
    if (updateError) {
      console.error('❌ Error updating user data:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save registration data' 
      });
    }
    
    // บันทึก log กิจกรรม
    await supabase
      .from('activity_logs')
      .insert({
        ref_code: refCode,
        line_user_id: data.line_user_id,
        action: 'Registration completed',
        machine_id: machineId,
        pdpa_status: pdpaStatus,
        timestamp: new Date().toISOString()
      });
    
    // ส่งข้อความแจ้งผู้ใช้ทางไลน์
    try {
      await client.pushMessage(data.line_user_id, {
        type: 'text',
        text: `🎉 การลงทะเบียนของคุณเสร็จสมบูรณ์แล้ว! คุณได้รับสิทธิ์ใช้งาน ${usageDays} วัน (ถึงวันที่ ${expiryDate.toLocaleDateString('th-TH')})`
      });
    } catch (lineError) {
      console.error('❌ Error sending completion message:', lineError);
      // ไม่ return error เพราะถึงส่งข้อความไม่ได้ การลงทะเบียนก็ยังสำเร็จ
    }
    
    // ส่งผลลัพธ์กลับไป VBA
    return res.status(200).json({ 
      success: true, 
      message: 'Registration completed successfully',
      expiryDate: expiryDate.toISOString(),
      usageDays
    });
    
  } catch (error) {
    console.error('❌ Error in completeRegistration:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * รีเซ็ตหรือส่งใหม่ Serial Key ให้กับผู้ใช้
 */
const resendSerialKey = async (req, res) => {
  try {
    const { refCode } = req.body;
    
    if (!refCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing Ref.Code' 
      });
    }
    
    // ค้นหาข้อมูลผู้ใช้
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id, serial_key')
      .eq('ref_code', refCode)
      .single();
      
    if (error || !data) {
      console.error('❌ Error finding user data:', error || 'Not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid Ref.Code' 
      });
    }
    
    // ส่ง Serial Key ไปที่ไลน์อีกครั้ง
    try {
      await client.pushMessage(data.line_user_id, {
        type: 'text',
        text: `🔄 รหัส Serial Key ของคุณคือ: ${data.serial_key}\nโปรดป้อนรหัสนี้ในช่อง Excel ของคุณเพื่อเปิดใช้งาน\nรหัสนี้จะหมดอายุใน 5 นาที`
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Serial Key resent successfully' 
      });
      
    } catch (lineError) {
      console.error('❌ Error resending Serial Key:', lineError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to resend Serial Key' 
      });
    }
    
  } catch (error) {
    console.error('❌ Error in resendSerialKey:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * ตรวจสอบสถานะการลงทะเบียน
 */
const checkRegistrationStatus = async (req, res) => {
  try {
    const { refCode } = req.params;
    
    if (!refCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing Ref.Code' 
      });
    }
    
    // ดึงข้อมูลสถานะ
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('status, pdpa_status, expires_at')
      .eq('ref_code', refCode)
      .single();
      
    if (error || !data) {
      console.error('❌ Error checking status:', error || 'Not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Ref.Code not found' 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      status: data.status,
      pdpaStatus: data.pdpa_status,
      expiresAt: data.expires_at
    });
    
  } catch (error) {
    console.error('❌ Error in checkRegistrationStatus:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = {
  verifyRefCode,
  verifySerialKey,
  completeRegistration,
  resendSerialKey,
  checkRegistrationStatus
};
