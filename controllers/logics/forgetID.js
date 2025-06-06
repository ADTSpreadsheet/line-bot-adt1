const { supabase } = require('../../utils/supabaseClient');

async function forgetIDController(req, res) {
  const startTime = Date.now();
  console.log('🚀 [forgetIDController] Starting forget ID process');
  
  try {
    const { ref_code } = req.body;
    console.log('📥 Request received:', { ref_code: ref_code ? `${ref_code.substring(0,3)}***` : 'undefined' });

    if (!ref_code) {
      console.warn('⚠️ Missing ref_code in request');
      return res.status(400).json({ 
        success: false, 
        message: 'Ref code is required' 
      });
    }

    // Validate ref_code format
    if (typeof ref_code !== 'string' || ref_code.length < 3) {
      console.warn('⚠️ Invalid ref_code format:', ref_code);
      return res.status(400).json({
        success: false,
        message: 'Invalid ref code format'
      });
    }

    // เพิ่ม timeout สำหรับ database queries
    const queryTimeout = 10000; // 10 วินาที
    console.log('🔍 Starting database queries with timeout:', queryTimeout + 'ms');

    // 1. ตรวจสอบใน starter_plan_users ก่อน
    console.log('🔍 Checking starter_plan_users table...');
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
      console.log('✅ Starter query completed:', starterUser ? 'User found' : 'User not found');
    } catch (timeoutError) {
      console.error('💥 Database timeout on starter_plan_users:', timeoutError.message);
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }

    if (starterUser && !starterError) {
      // 1.1 เจอใน starter_plan_users → ส่งข้อมูลผ่าน Bot
      console.log('👤 User found in starter_plan_users, attempting to send LINE message...');
      try {
        const botMessage = `นี่คือ ชื่อผู้ใช้งานและรหัสผ่านของคุณ\nUsername = "${starterUser.username}"\nPassword = "${starterUser.password}"`;
        
        console.log('🤖 Calling LINE Bot API...');
        const botStartTime = Date.now();
        
        // เรียก LINE Bot API (ต้องใส่ LINE Bot logic ตรงนี้)
        const botResult = await sendLineMessage(ref_code, botMessage);
        
        const botDuration = Date.now() - botStartTime;
        console.log(`🤖 LINE Bot API completed in ${botDuration}ms, success: ${botResult.success}`);
        
        if (botResult.success) {
          const totalDuration = Date.now() - startTime;
          console.log(`✅ [forgetIDController] Success - Total duration: ${totalDuration}ms`);
          return res.status(200).json({
            success: true,
            message: 'Username and password sent to your LINE Bot'
          });
        } else {
          console.warn('❌ LINE Bot failed to send message (User may have blocked bot)');
          return res.status(403).json({
            success: false,
            message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
          });
        }
      } catch (botError) {
        console.error('💥 LINE Bot error (starter_plan_users):', {
          message: botError.message,
          code: botError.code,
          stack: botError.stack?.substring(0, 200)
        });
        return res.status(403).json({
          success: false,
          message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
        });
      }
    }

    // 2. ถ้าไม่เจอใน starter_plan_users → ตรวจสอบใน license_holders
    console.log('🔍 User not found in starter_plan_users, checking license_holders table...');
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
      console.log('✅ License query completed:', licenseUser ? 'User found' : 'User not found');
    } catch (timeoutError) {
      console.error('💥 Database timeout on license_holders:', timeoutError.message);
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }

    if (licenseUser && !licenseError) {
      // 2.1 เจอใน license_holders → ส่งข้อมูลผ่าน Bot
      console.log('👤 User found in license_holders, attempting to send LINE message...');
      try {
        const botMessage = `นี่คือ ชื่อผู้ใช้งานและรหัสผ่านของคุณ\nUsername = "${licenseUser.username}"\nPassword = "${licenseUser.password}"`;
        
        console.log('🤖 Calling LINE Bot API...');
        const botStartTime = Date.now();
        
        // เรียก LINE Bot API
        const botResult = await sendLineMessage(ref_code, botMessage);
        
        const botDuration = Date.now() - botStartTime;
        console.log(`🤖 LINE Bot API completed in ${botDuration}ms, success: ${botResult.success}`);
        
        if (botResult.success) {
          const totalDuration = Date.now() - startTime;
          console.log(`✅ [forgetIDController] Success - Total duration: ${totalDuration}ms`);
          return res.status(200).json({
            success: true,
            message: 'Username and password sent to your LINE Bot'
          });
        } else {
          console.warn('❌ LINE Bot failed to send message (User may have blocked bot)');
          return res.status(403).json({
            success: false,
            message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
          });
        }
      } catch (botError) {
        console.error('💥 LINE Bot error (license_holders):', {
          message: botError.message,
          code: botError.code,
          stack: botError.stack?.substring(0, 200)
        });
        return res.status(403).json({
          success: false,
          message: 'Cannot send message to LINE Bot. You may have blocked ADTLine-Bot'
        });
      }
    }

    // 2.2 ไม่เจอใน license_holders เลย
    console.warn('❌ Ref code not found in both tables:', ref_code.substring(0,3) + '***');
    return res.status(400).json({
      success: false,
      message: 'Ref code not found'
    });

  } catch (err) {
    const totalDuration = Date.now() - startTime;
    console.error('💥 Exception in forgetIDController:', {
      message: err.message,
      code: err.code,
      duration: totalDuration + 'ms',
      stack: err.stack?.substring(0, 300)
    });
    
    // เช็คประเภทของ Error
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('🌐 Network/Server connectivity error');
      return res.status(500).json({
        success: false,
        message: 'Server is currently unavailable. Please try again later.'
      });
    }
    
    // Database timeout หรือ connection error
    if (err.message && (err.message.includes('timeout') || err.message.includes('connection'))) {
      console.error('🗄️ Database connection/timeout error');
      return res.status(500).json({
        success: false,
        message: 'Database connection timeout. Please try again later.'
      });
    }
    
    // Error อื่นๆ
    console.error('🔥 Unhandled error in forgetIDController');
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
}

// ฟังก์ชันสำหรับส่งข้อความผ่าน LINE Bot
async function sendLineMessage(refCode, message) {
  const startTime = Date.now();
  console.log('🤖 [sendLineMessage] Starting LINE Bot API call for ref:', refCode.substring(0,3) + '***');
  
  try {
    // TODO: ใส่ LINE Bot API logic ตรงนี้
    // - ค้นหา LINE User ID จาก ref_code
    // - ส่งข้อความผ่าน LINE Messaging API
    
    console.log('📞 Calling LINE Messaging API...');
    
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

    const duration = Date.now() - startTime;
    console.log(`📞 LINE API response in ${duration}ms:`, {
      status: lineResponse.status,
      statusText: lineResponse.statusText
    });

    if (lineResponse.ok) {
      console.log('✅ LINE message sent successfully');
      return { success: true };
    } else {
      const errorText = await lineResponse.text();
      console.error('❌ LINE API error:', {
        status: lineResponse.status,
        statusText: lineResponse.statusText,
        error: errorText.substring(0, 200)
      });
      return { success: false, error: errorText };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('💥 LINE Bot API exception:', {
      message: error.message,
      code: error.code,
      duration: duration + 'ms',
      stack: error.stack?.substring(0, 200)
    });
    return { success: false, error: error.message };
  }
}

module.exports = forgetIDController;
