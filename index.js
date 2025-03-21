/**
 * index.js
 * ไฟล์หลักของแอปพลิเคชัน
 */

const express = require('express');
const cors = require('cors');
const CONFIG = require('./config');
const db = require('./database');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

// สร้าง Express app
const app = express();

// ใช้ middleware
app.use(cors());
app.use(express.json());

// ใช้เส้นทาง
app.use('/', routes);

// ใช้ middleware จัดการข้อผิดพลาด
app.use(errorHandler);

// เริ่มต้นเซิร์ฟเวอร์
const startServer = async () => {
  try {
    // ทดสอบการเชื่อมต่อกับฐานข้อมูล
    await db.testConnection();
    console.log('Successfully connected to Supabase');
    
    // เริ่มต้นเซิร์ฟเวอร์
    app.listen(CONFIG.SERVER.PORT, () => {
      console.log(`Server is running on port ${CONFIG.SERVER.PORT}`);
      console.log(`Webhook URL: ${CONFIG.SERVER.URL}/webhook`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Export app for testing
module.exports = app;
