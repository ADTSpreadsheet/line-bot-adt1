// Comprehensive LINE Bot Authentication System
require('dotenv').config(); // Load environment variables
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Express App Initialization
const app = express();

// Security Middleware
app.use(helmet()); // Adds various HTTP headers for security

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});
app.use(limiter);

// CORS Configuration
const corsOptions = {
  origin: [
    'https://your-frontend-domain.com', 
    'http://localhost:3000',
    'https://adt-line-bot.onrender.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-line-signature']
};
app.use(cors(corsOptions));

// Enhanced JSON Parsing Middleware
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  },
  limit: '1mb' // Prevent large payload attacks
}));

// Logging Middleware (Optional - can use winston or morgan in production)
const logRequest = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};
app.use(logRequest);

// Configuration from Environment Variables
const lineConfigBot1 = {
  channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_BOT1_CHANNEL_SECRET || '',
};

const lineConfigBot2 = {
  channelAccessToken: process.env.LINE_BOT2_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_BOT2_CHANNEL_SECRET || '',
};

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Bot Configuration Constants
const BOT1_ID = process.env.LINE_BOT1_ID || 'bot1_id';
const BOT2_ID = process.env.LINE_BOT2_ID || 'bot2_id';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '1234-golfkop';

// LINE Client Initialization
const lineClientBot1 = new line.Client(lineConfigBot1);
const lineClientBot2 = new line.Client(lineConfigBot2);

// Bot Clients Mapping
const botClients = {
  [BOT1_ID]: lineClientBot1,
  [BOT2_ID]: lineClientBot2
};

// Utility Functions
/**
 * Generate a random 6-digit reference code
 * @returns {string} 6-digit reference code
 */
function generateRefCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a random serial key with numbers and characters
 * @returns {string} Serial key in format XXXX-YYYY
 */
function generateSerialKey() {
  const serialNumber = Math.floor(1000 + Math.random() * 9000).toString();
  const serialChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${serialNumber}-${serialChars}`;
}

/**
 * Generate expiration timestamp
 * @param {number} minutes - Minutes until expiration
 * @returns {string} ISO formatted expiration timestamp
 */
function getExpirationTime(minutes = 15) {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + minutes);
  return expirationTime.toISOString();
}

/**
 * Validate LINE webhook signature
 * @param {Object} body - Webhook request body
 * @param {string} signature - Signature from LINE headers
 * @param {string} channelSecret - Bot channel secret
 * @returns {boolean} Signature validation result
 */
function validateSignature(body, signature, channelSecret) {
  try {
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(Buffer.from(JSON.stringify(body)))
      .digest('base64');
    return hash === signature;
  } catch (error) {
    console.error('Signature Validation Error:', error);
    return false;
  }
}

/**
 * Handle individual LINE webhook events
 * @param {Object} event - LINE webhook event
 * @param {string} botId - Bot identifier
 * @returns {Promise} Processed event result
 */
async function handleEvent(event, botId) {
  try {
    // Log incoming event for debugging
    console.log(`Received event for Bot ${botId}:`, JSON.stringify(event, null, 2));

    // Only process text messages
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('Non-text message event, skipping');
      return null;
    }

    const userId = event.source.userId;
    const messageText = event.message.text.trim().toUpperCase();
    const lineClient = botClients[botId];

    // Command handling
    switch(messageText) {
      case 'REQ_REFCODE':
        return handleRefCodeRequest(userId, lineClient, botId);
      default:
        return lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: 'สวัสดีครับ! พิมพ์ REQ_REFCODE เพื่อขอรหัสอ้างอิง'
        });
    }
  } catch (error) {
    console.error('Event Handling Error:', error);
    return null;
  }
}

/**
 * Handle Reference Code Request
 * @param {string} userId - LINE User ID
 * @param {Object} lineClient - LINE Messaging API client
 * @param {string} botId - Bot identifier
 * @returns {Promise} Result of sending reference code
 */
async function handleRefCodeRequest(userId, lineClient, botId) {
  try {
    const refCode = generateRefCode();
    const expiresAt = getExpirationTime();

    // Insert session to Supabase
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

    // Customize message based on bot
    const customMessage = botId === BOT1_ID
      ? "กรุณานำรหัสนี้ไปกรอกในช่อง Ref. Code และกดปุ่ม Verify Code"
      : "กรุณานำรหัสนี้ไปกรอกในฟอร์ม VBA และกดปุ่ม Verify Code";

    // Send Ref Code to user
    return lineClient.pushMessage(userId, {
      type: 'text',
      text: `รหัสอ้างอิง (Ref.Code) ของคุณคือ: ${refCode}\n${customMessage}\n(รหัสนี้จะหมดอายุใน 15 นาที)`
    });
  } catch (error) {
    console.error('Ref Code Generation Error:', error);
    return lineClient.pushMessage(userId, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่อีกครั้ง'
    });
  }
}

// Webhook Route with Comprehensive Error Handling
app.post('/webhook', async (req, res) => {
  // Comprehensive logging
  console.log('Webhook Called:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: JSON.stringify(req.body)
  });

  // Validate Content-Type
  if (req.headers['content-type'] !== 'application/json') {
    console.error('Invalid Content-Type');
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  try {
    const signature = req.headers['x-line-signature'];
    const events = req.body.events || [];

    // Check for empty events
    if (!events.length) {
      console.warn('No events in webhook payload');
      return res.status(200).json({ message: 'No events to process' });
    }

    // Determine Bot and Validate Signature
    const destination = events[0].destination;
    let botId = null;
    let isValid = false;

    if (destination === BOT1_ID) {
      botId = BOT1_ID;
      isValid = validateSignature(req.body, signature, lineConfigBot1.channelSecret);
    } else if (destination === BOT2_ID) {
      botId = BOT2_ID;
      isValid = validateSignature(req.body, signature, lineConfigBot2.channelSecret);
    }

    // Signature Validation
    if (!isValid) {
      console.error('Invalid webhook signature', { 
        destination, 
        signature, 
        body: JSON.stringify(req.body) 
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process Events
    if (botId) {
      await Promise.all(events.map(event => handleEvent(event, botId)));
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook Processing Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Additional Endpoints for Ref Code and Serial Key Verification
app.post('/verify-ref-code', async (req, res) => {
  try {
    const { refCode } = req.body;
    
    // Verify Reference Code
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(400).json({ 
        error: 'Invalid Ref.Code', 
        message: 'รหัสอ้างอิงไม่ถูกต้องหรือหมดอายุแล้ว' 
      });
    }

    // Generate Serial Key
    const serialKey = generateSerialKey();
    const serialKeyExpiresAt = getExpirationTime(30); // 30 minutes

    // Update Session
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        serial_key: serialKey,
        status: 'AWAITING_VERIFICATION',
        expires_at: serialKeyExpiresAt
      })
      .eq('id', data.id);

    if (updateError) {
      throw updateError;
    }

    // Notify User via LINE
    const lineClient = botClients[data.bot_id] || lineClientBot1;
    await lineClient.pushMessage(data.line_user_id, {
      type: 'text',
      text: `Serial Key ของคุณคือ: ${serialKey}\nกรุณานำ Serial Key นี้ไปกรอก และกด Enter เพื่อยืนยัน\n(Serial Key นี้จะหมดอายุใน 30 นาที)`
    });

    res.status(200).json({ 
      success: true,
      message: 'Serial Key generated and sent to user' 
    });
  } catch (error) {
    console.error('Ref Code Verification Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// 404 Handler
app.use((req, res, next) => {
  console.warn(`Unhandled route: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Unexpected Error', 
    message: err.message 
  });
});

// Server Initialization
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Supabase Connection Test
  try {
    const { data, error } = await supabase.from('auth_sessions').select('count').limit(1);
    if (error) throw error;
    console.log('Supabase connection successful');
  } catch (error) {
    console.error('Supabase connection failed:', error);
  }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Export for testing or additional configuration
module.exports = app;
