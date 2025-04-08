// routes/line-redirect.js

const express = require('express');
const router = express.Router();

router.get('/line-redirect', (req, res) => {
  const source = req.query.source;  // รับค่า source จาก URL query parameter

  console.log('Received source:', source); // ตรวจสอบค่าใน console log

  // หากพบ source ที่ต้องการ
  if (source === 'userform3') {
    console.log('Source is from UserForm3');
    // บันทึกค่า source ลงในฐานข้อมูล หรือใน session
    // จากนั้นให้เปลี่ยนเส้นทางไปที่ LINE bot
    res.redirect(`https://line.me/R/ti/p/%40@adtline-bot`);
  } else if (source === 'verifylicenseform') {
    console.log('Source is from VerifyLicenseForm');
    // บันทึกค่า source ลงในฐานข้อมูล หรือใน session
    res.redirect(`https://line.me/R/ti/p/%40@adtline-bot`);
  } else {
    // กรณีที่ไม่มี source
    console.log('Source is unknown or not provided');
    res.redirect(`https://line.me/R/ti/p/%40@adtline-bot`);
  }
});

module.exports = router;
