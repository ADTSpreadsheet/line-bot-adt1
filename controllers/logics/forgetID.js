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

    if (typeof ref_code !== 'string' || ref_code.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ref code format'
      });
    }

    const queryTimeout = 10000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), queryTimeout)
    );

    // 1. ตรวจสอบใน starter_plan_users ก่อน
    const starterPromise = supabase
      .from('starter_plan_users')
      .select('username, password, ref_code')
      .eq('ref_code', ref_code)
      .single();

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
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(500).json({
        success: false,
        message: 'Server is currently unavailable. Please try again later.'
      });
    }
    
    if (err.message && (err.message.includes('timeout') || err.message.includes('connection'))) {
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}

async function sendLineMessage(refCode, message) {
  try {
    // หา LINE User ID จาก auth_sessions
    const { data: authData, error: authError } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', refCode)
      .single();

    if (authError || !authData || !authData.line_user_id) {
      return { success: false, error: 'LINE User ID not found' };
    }

    const lineUserId = authData.line_user_id;
    
    // ส่งข้อความผ่าน LINE Messaging API
    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: lineUserId,
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
    return { success: false, error: error.message };
  }
}

module.exports = forgetIDController;
