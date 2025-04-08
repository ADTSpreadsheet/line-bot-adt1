const express = require('express');
const router = express.Router();

router.get('/line-redirect', (req, res) => {
  const source = req.query.source;  // รับค่า source จาก URL query parameter

  // เพิ่ม log สำหรับตรวจสอบว่าได้ค่า source หรือไม่
  console.log('Received source:', source); // ตรวจสอบค่าใน console log

  // หาก source ไม่มีค่า หรือไม่พบข้อมูล
  if (!source) {
    console.warn('No source parameter received');  // เพิ่ม log เมื่อไม่พบ source
    return res.redirect('https://line.me/R/ti/p/%40adtline-bot'); // ถ้าไม่มี source ให้ redirect ไป URL ปกติ
  }

  // จากนั้นตรวจสอบว่า source มาจากไหน
  if (source === 'UserForm3') {
    console.log('Source is from UserForm3');
    // บันทึกค่า source ลงใน session
    req.session.source = source;
    console.log('Source saved to session:', req.session.source); // ตรวจสอบค่าใน session
    res.redirect('https://line.me/R/ti/p/%40adtline-bot');
  } else if (source === 'VerifyLicenseForm') {
    console.log('Source is from VerifyLicenseForm');
    // บันทึกค่า source ลงใน session
    req.session.source = source;
    console.log('Source saved to session:', req.session.source); // ตรวจสอบค่าใน session
    res.redirect('https://line.me/R/ti/p/%40adtline-bot');
  } else {
    // กรณีที่ไม่ตรงกับที่คาดหวัง
    console.log('Source is unknown or not provided');
    res.redirect('https://line.me/R/ti/p/%40adtline-bot');
  }
});

module.exports = router;
