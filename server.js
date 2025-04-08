// server.js
const express = require('express');
const app = express();
const session = require('express-session');
const lineRedirectRoute = require('./routes/line-redirect');  // นำเข้า route ที่สร้างไว้

// ใช้ session สำหรับเก็บข้อมูลของผู้ใช้
app.use(session({
  secret: 'c6dd9d51591ae867df634cf5ff032159',
  resave: false,
  saveUninitialized: true
}));

app.use(lineRedirectRoute);  // ใช้เส้นทางจากไฟล์ line-redirect.js

// เปิดเซิร์ฟเวอร์
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
