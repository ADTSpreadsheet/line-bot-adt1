require('dotenv').config(); 
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const cors = require('cors'); 
const app = express();

app.use(cors());
app.use(express.json());

const lineConfigBot1 = {
  channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN || '0oVvErESHf2ZQNTM+gIJbo4XPmBp8GwXeLQ5Qr+A5IRG9XqkrPTRoyRCpXXeyV89GlWnSktNpiTP7ddY7HPGuQHchWXFs4/5Mnw1rrnjUuDaxQ2O2b8/gN/w1Fq+GzYnP1MJ7NLCxz9ygk5NBRE0hgdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_BOT1_CHANNEL_SECRET || 'c6dd9d51591ae867df634cf5ff032159',
};

const lineConfigBot2 = {
  channelAccessToken: process.env.LINE_BOT2_ACCESS_TOKEN || 'VcdMebbh7xEnFBj3t58u/vjAOfjBbrelQs0pLGPTUmvrc3wHYjyWhAA98hy/SkWE1Tj4HjRxMzQu0V9eFYXH78QVYfxLftp6uqyzZsLACPZMbXIkjxqyqJPVYbcg507U3TwgUjZh+Y/7zpy/IzmZpQdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_BOT2_CHANNEL_SECRET || '3558642df20f8e7e357c70c5ffd826f4',
};

const BOT1_ID = process.env.LINE_BOT1_ID || 'bot1_id';
const BOT2_ID = process.env.LINE_BOT2_ID || 'bot2_id';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '1234-golfkop';
const supabaseUrl = process.env.SUPABASE_URL || 'https://wpxpukbvynxawfxcdroj.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweHB1a2J2eW54YXdmeGNkcm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzODY3OTIsImV4cCI6MjA1Nzk2Mjc5Mn0.JaYLI4p9r8A3l_eb5QrvhnK5_Vz16crWzdOkjO-veO8';
const supabase = createClient(supabaseUrl, supabaseKey);
const lineClientBot1 = new line.Client(lineConfigBot1);
const lineClientBot2 = new line.Client(lineConfigBot2);
const botClients = {
  [BOT1_ID]: lineClientBot1,
  [BOT2_ID]: lineClientBot2
};

function generateRefCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSerialKey() {
  const serialNumber = Math.floor(1000 + Math.random() * 9000).toString();
  const serialChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return serialNumber + "-" + serialChars;
}

function getExpirationTime() {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 15);
  return expirationTime.toISOString();
}

function validateSignature(body, signature, channelSecret) {
  try {
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(Buffer.from(JSON.stringify(body)))
      .digest('base64');
    
    console.log('Calculated Hash:', hash);
    console.log('Received Signature:', signature);
    
    return hash === signature;
  } catch (error) {
    console.error('Signature Validation Error:', error);
    return false;
  }
}

app.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('Webhook Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Webhook Request Body:', JSON.stringify(req.body, null, 2));

    const signature = req.headers['x-line-signature'];
    const events = req.body.events;
    
    console.log('Signature:', signature);
    console.log('BOT1_ID:', BOT1_ID);
    console.log('BOT2_ID:', BOT2_ID);

    if (!events || events.length === 0) {
      console.log('No events received');
      return res.status(200).end();
    }

    const destination = events[0].destination;
    console.log('Destination:', destination);
    
    let botId = null;
    let isValid = false;
    
    if (destination === BOT1_ID) {
      botId = BOT1_ID;
      isValid = validateSignature(req.body, signature, lineConfigBot1.channelSecret);
      console.log('Checking Bot1 Signature');
    } else if (destination === BOT2_ID) {
      botId = BOT2_ID;
      isValid = validateSignature(req.body, signature, lineConfigBot2.channelSecret);
      console.log('Checking Bot2 Signature');
    } else {
      console.error('Unknown destination:', destination);
      return res.status(400).send('Unknown Bot');
    }
    
    if (!isValid) {
      console.error('Invalid signature');
      console.error('Received Signature:', signature);
      console.error('Bot Config Secret:', 
        botId === BOT1_ID ? lineConfigBot1.channelSecret : lineConfigBot2.channelSecret
      );
      return res.status(401).send('Invalid signature');
    }
    
    if (botId) {
      await Promise.all(events.map(event => {
        console.log('Processing event:', JSON.stringify(event, null, 2));
        return handleEvent(event, botId);
      }));
    }
    
    res.status(200).end();
  } catch (err) {
    console.error('Comprehensive Webhook Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack
    });
  }
});

async function handleEvent(event, botId) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('Non-text message event, skipping');
    return null;
  }

  const userId = event.source.userId;
  const messageText = event.message.text;
  console.log(`Received message from user ${userId}: ${messageText}`);

  const lineClient = botClients[botId];
  
  if (messageText.startsWith('REQ_REFCODE')) {
    return handleRefCodeRequest(userId, messageText, lineClient, botId)
  }

  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: 'สวัสดีครับ! พิมพ์ REQ_REFCODE เพื่อขอรหัสอ้างอิง'
  });
}

async function handleRefCodeRequest(userId, messageText, lineClient, botId) {
  try {
    const { data: existingRefCode, error: existingError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('line_user_id', userId)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .single();

    // ตรวจสอบว่าเกิด error ในการดึงข้อมูลจาก Supabase หรือไม่
    if (existingError) {
      console.error("Error fetching Ref.Code:", existingError);
      return lineClient.pushMessage(userId, {
        type: 'text',
        text: 'เกิดข้อผิดพลาดในการตรวจสอบ Ref.Code กรุณาลองใหม่อีกครั้ง'
      });
    }

    // ตรวจสอบว่ามีข้อมูล Ref.Code อยู่จริงหรือไม่
    if (!existingRefCode || !existingRefCode.expires_at) {
      return lineClient.pushMessage(userId, {
        type: 'text',
        text: 'ไม่พบ Ref.Code ที่ใช้งานได้ กรุณาขอรหัสใหม่'
      });
    }

    // ตรวจสอบเวลาที่เหลือก่อนหมดอายุ
    const remainingTime = new Date(existingRefCode.expires_at) - new Date();
    if (remainingTime < 0) {
      return lineClient.pushMessage(userId, {
        type: 'text',
        text: 'Ref.Code ของคุณหมดอายุแล้ว กรุณาขอใหม่'
      });
    }

    // แปลงเป็นนาที
    const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));

    return lineClient.pushMessage(userId, {
      type: 'text',
      text: `คุณมี Ref.Code ที่ยังไม่ได้ใช้งาน\nรหัสเดิม: ${existingRefCode.ref_code}\nจะหมดอายุใน ${remainingMinutes} นาที\nกรุณาใช้รหัสเดิมก่อน`
    });

  } catch (error) {
    console.error("Unexpected Error:", error);
    return lineClient.pushMessage(userId, {
      type: 'text',
      text: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล กรุณาลองใหม่'
    });
  }
}

    const refCode = generateRefCode();
    console.log(`Generating Ref.Code for user ${userId}. Ref.Code: ${refCode}`);

    const expiresAt = getExpirationTime();

    const { data, error } = await supabase
      .from('auth_sessions')
      .insert([{ 
        line_user_id: userId,
        bot_id: botId,
        ref_code: refCode,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      }]);

    if (error) throw error;

    let messageText = `รหัสอ้างอิง (Ref.Code) ของคุณคือ: ${refCode}\n`;
    
    if (botId === BOT1_ID) {
      messageText += "กรุณานำรหัสนี้ไปกรอกในช่อง Ref. Code และกดปุ่ม Verify Code";
    } else {
      messageText += "กรุณานำรหัสนี้ไปกรอกในฟอร์ม VBA และกดปุ่ม Verify Code";
    }
    
    messageText += "\n(รหัสนี้จะหมดอายุใน 15 นาที)";

    return lineClient.pushMessage(userId, {
      type: 'text',
      text: messageText
    });
  } catch (error) {
    console.error('Error generating ref code:', error);
    return lineClient.pushMessage(userId, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่อีกครั้ง'
    });
  }
}

    const serialKey = generateSerialKey();
    console.log('Generated Serial Key:', serialKey);

    const serialKeyExpiresAt = new Date();
    serialKeyExpiresAt.setMinutes(serialKeyExpiresAt.getMinutes() + 30);

    const { data: updateData, error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        serial_key: serialKey,
        status: 'AWAITING_VERIFICATION',
        updated_at: new Date().toISOString(),
        expires_at: serialKeyExpiresAt.toISOString()
      })
      .eq('id', refCodeData.id);

    if (updateError) {
      console.error('Error updating Serial Key:', updateError);
      return res.status(500).json({ error: 'Failed to update Serial Key' });
    }

    const lineClient = botClients[refCodeData.bot_id] || lineClientBot1;

    await lineClient.pushMessage(refCodeData.line_user_id, {
      type: 'text',
      text: `Serial Key ของคุณคือ: ${serialKey}\nกรุณานำ Serial Key นี้ไปกรอก และกด Enter เพื่อยืนยัน\n(Serial Key นี้จะหมดอายุใน 30 นาที)`
    });

    res.status(200).json({ 
      success: true,
      message: 'Serial Key generated and sent to user' 
    });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/verify-serial-key', express.json(), async (req, res) => {
  try {
    const { serialKey, machineId, ipAddress } = req.body;
    console.log('Received Serial Key from Userform3:', serialKey);
    
    if (machineId || ipAddress) {
      console.log('Machine Info:', { machineId, ipAddress });
      const { data: serialKeyData, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('serial_key', serialKey)
      .eq('status', 'AWAITING_VERIFICATION')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !serialKeyData) {
      console.error('Error fetching Serial Key:', error);
      return res.status(400).json({ 
        error: 'Invalid Serial Key',
        message: 'Serial Key ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่'
      });
    }

    const updateData = { 
      status: 'VERIFIED',
      updated_at: new Date().toISOString()
    };
    
    if (machineId) updateData.machine_id = machineId;
    if (ipAddress) updateData.ip_address = ipAddress;

    const { data: updatedData, error: updateError } = await supabase
      .from('auth_sessions')
      .update(updateData)
      .eq('id', serialKeyData.id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      return res.status(500).json({ error: 'Failed to update status' });
    }

    const lineClient = botClients[serialKeyData.bot_id] || lineClientBot1;

    await lineClient.pushMessage(serialKeyData.line_user_id, {
      type: 'text',
      text: `การยืนยันสำเร็จ! ขอบคุณที่ใช้บริการของเรา`
    });
    
const notificationText = `มีผู้ใช้ลงทะเบียนเสร็จสมบูรณ์!\nUser ID: ${serialKeyData.line_user_id}\nSerial Key: ${serialKey}`;

const machineInfo = [];
if (machineId) machineInfo.push(`Machine ID: ${machineId}`);
if (ipAddress) machineInfo.push(`IP Address: ${ipAddress}`);

const fullNotificationText = notificationText + 
  (machineInfo.length > 0 ? '\n' + machineInfo.join('\n') : '') + 
  `\nเวลา: ${new Date().toLocaleString("th-TH", {timeZone: "Asia/Bangkok"})}`;

await lineClientBot2.pushMessage(ADMIN_USER_ID, {
  type: 'text',
  text: fullNotificationText
});
try {
  const result = await someAsyncFunction(); 
  res.status(200).json({ 
    verified: true,
    message: 'Serial Key verified successfully'
  });
} catch (err) {
  console.error('Webhook Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack 
  });
}

app.post('/report-machine-info', express.json(), async (req, res) => {
  try {
    const { refCode, serialKey, machineId, ipAddress } = req.body;
    console.log('Received machine info:', { refCode, serialKey, machineId, ipAddress });

    let query = supabase.from('auth_sessions').select('*');
    
    if (serialKey) {
      query = query.eq('serial_key', serialKey);
    } else if (refCode) {
      query = query.eq('ref_code', refCode);
    } else {
      return res.status(400).json({ error: 'Missing refCode or serialKey' });
    }
    
    const { data: sessionData, error } = await query.single();

    if (error || !sessionData) {
      console.error('Error fetching session data:', error);
      return res.status(400).json({ error: 'Invalid reference or serial key' });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (machineId) updateData.machine_id = machineId;
    if (ipAddress) updateData.ip_address = ipAddress;

    const { data: updateResult, error: updateError } = await supabase
      .from('auth_sessions')
      .update(updateData)
      .eq('id', sessionData.id);

    if (updateError) {
      console.error('Error updating machine info:', updateError);
      return res.status(500).json({ error: 'Failed to update machine info' });
    }

    const machineInfo = [];
    if (machineId) machineInfo.push(`Machine ID: ${machineId}`);
    if (ipAddress) machineInfo.push(`IP Address: ${ipAddress}`);
    
    if (machineInfo.length > 0) {
      await lineClientBot2.pushMessage(ADMIN_USER_ID, {
        type: 'text',
        text: `ได้รับข้อมูลเครื่องจากผู้ใช้!\nUser ID: ${sessionData.line_user_id}\n${machineInfo.join('\n')}\nเวลา: ${new Date().toLocaleString("th-TH", {timeZone: "Asia/Bangkok"})}`
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'Machine information reported successfully' 
    });
  } catch (err) {
    console.error('Report Machine Info Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/test-vba-connection', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'VBA connection successful' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.SERVER_URL || 'http://localhost:' + PORT}/webhook`);
  
  try {
    const { data, error } = await supabase.from('auth_sessions').select('count').limit(1);
    if (error) throw error;
    console.log('Successfully connected to Supabase');
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
  }
});
      
module.exports = app;
