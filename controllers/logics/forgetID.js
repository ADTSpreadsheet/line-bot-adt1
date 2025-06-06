const { supabase } = require('../../utils/supabaseClient');

async function forgetIDController(req, res) {
  try {
    const { ref_code } = req.body;

    if (!ref_code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ref code is required' 
      });
    }

    // เพิ่ม timeout สำหรับ database queries
    const queryTimeout = 10000; // 10 วินาที

    // 1. ตรวจสอบใน starter_plan_users ก่อน
    const starterPromise = supabase
      .from('starter_plan_users')
      .select('username, password, ref_code')
      .eq('ref_code', ref_code)
      .single();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), queryTimeout)
    );

    let starterUser, starterError;
    try {
      const result = await Promise.race([starterPromise, timeoutPromise]);
      starterUser = result.data;
      starterError = result.error;
    } catch (timeoutError) {
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }

    if (starterUser && !starterError) {
      // 1.1 เจอใน starter_plan_users → ส่งข้อมูลผ่าน Bot
      try {
        const botMessage = `นี่คือ ชื่อผู้ใช้งานและรหัสผ่านของคุณ\nUsername = "${starterUser.username}"\nPassword = "${starterUser.password}"`;
        
        // เรียก LINE Bot API (ต้องใส่ LINE Bot logic ตรงนี้)
        const botResult = await sendLineMessage(ref_code, botMessage);
        
        if (botResult.success) {
          return res.status(200).json({
            success: true,
            message: 'Username and password sent to your LINE Bot'
          });
        } else {
          return res.status(403).json({
            success: false,
            message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
          });
        }
      } catch (botError) {
        return res.status(403).json({
          success: false,
          message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
        });
      }
    }

    // 2. ถ้าไม่เจอใน starter_plan_users → ตรวจสอบใน license_holders
    let licenseUser, licenseError;
    try {
      const licensePromise = supabase
        .from('license_holders')
        .select('username, password, ref_code')
        .eq('ref_code', ref_code)
        .single();
      
      const result = await Promise.race([licensePromise, timeoutPromise]);
      licenseUser = result.data;
      licenseError = result.error;
    } catch (timeoutError) {
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }

    if (licenseUser && !licenseError) {
      // 2.1 เจอใน license_holders → ส่งข้อมูลผ่าน Bot
      try {
        const botMessage = `นี่คือ ชื่อผู้ใช้งานและรหัสผ่านของคุณ\nUsername = "${licenseUser.username}"\nPassword = "${licenseUser.password}"`;
        
        // เรียก LINE Bot API
        const botResult = await sendLineMessage(ref_code, botMessage);
        
        if (botResult.success) {
          return res.status(200).json({
            success: true,
            message: 'Username and password sent to your LINE Bot'
          });
        } else {
          return res.status(403).json({
            success: false,
            message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
          });
        }
      } catch (botError) {
        return res.status(403).json({
          success: false,
          message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
        });
      }
    }

    // 2.2 ไม่เจอใน license_holders เลย
    return res.status(400).json({
      success: false,
      message: 'Ref code not found'
    });

  } catch (err) {
    console.error('Exception in forgetIDController:', err);
    
    // เช็คประเภทของ Error
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(500).json({
        success: false,
        message: 'Server is currently unavailable. Please try again later.'
      });
    }
    
    // Database timeout หรือ connection error
    if (err.message && (err.message.includes('timeout') || err.message.includes('connection'))) {
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }
    
    // Error อื่นๆ
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}

// ฟังก์ชันสำหรับส่งข้อความผ่าน LINE Bot
async function sendLineMessage(refCode, message) {
  try {
    // TODO: ใส่ LINE Bot API logic ตรงนี้
    // - ค้นหา LINE User ID จาก ref_code
    // - ส่งข้อความผ่าน LINE Messaging API
    
    // ตัวอย่าง (ต้องแก้ไขตาม LINE Bot ของคุณ)
    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: 'USER_LINE_ID', // ต้องหา LINE User ID จาก ref_code
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });

    if (lineResponse.ok) {
      return { success: true };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error('LINE Bot error:', error);
    return { success: false };
  }
}

module.exports = forgetIDController;
