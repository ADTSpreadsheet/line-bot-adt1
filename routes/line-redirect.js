const express = require('express');
const router = express.Router();
const session = require('express-session');

// ใช้ session สำหรับจัดเก็บค่าที่ได้จาก URL
router.use(session({
  secret: 'c6dd9d51591ae867df634cf5ff032159',
  resave: false,
  saveUninitialized: true
}));

// เส้นทางที่เมื่อผู้ใช้สแกน QR code แล้วจะถูกส่งมายังที่นี่
router.get('/line-redirect', (req, res) => {
  // ตรวจสอบว่า URL มีค่า source หรือไม่
  const source = req.query.source;

  // ถ้ามี source ให้เก็บลง session
  if (source) {
    req.session.source = source;
    console.log(`Source received: ${source}`);
  } else {
    console.log('No source parameter received.');
  }

  // เมื่อรับข้อมูลจาก URL แล้วทำการ redirect ไปที่ URL ของ LINE Bot
  res.redirect('https://line.me/R/ti/p/%40@adtline-bot');
});

module.exports = router;
