// index.js - LINE Bot ตัวที่ 1 (เวอร์ชันสมบูรณ์ รองรับ rawBody แล้ว)
const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const registrationRoutes = require('./routes/registration');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// ส่วนที่ 1 ของระบบเรียกข้อความ PDPA เรียกใช้ โฟร์เดอร์ Routes ✅
const pdpaRoutes = require('./routes/pdpaText');








//  ส่วนที่ 2 ของระบบเรียกข้อความ PDPA คือการใช้ app.use ✅
app.use('/', pdpaRoutes);









//  ส่วนที่ 3 ของระบบเรียกข้อความ PDPA การเปิด Server ✅
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);



});










