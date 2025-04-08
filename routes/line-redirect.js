// routes/line-redirect.js
const express = require('express');
const router = express.Router();

// ตัวเก็บข้อมูล source สำหรับผู้ใช้
let sourceData = {};  // เก็บข้อมูล source ไว้ในหน่วยความจำ (สามารถเปลี่ยนไปใช้ฐานข้อมูลได้)

router.get('/line-redirect', (req, res) => {
  const { source } = req.query;
  const userId = req.session.userId || "defaultUserId";  // ใช้ session หรือ cookie เก็บข้อมูล

  if (source) {
    // บันทึก source ลงในฐานข้อมูลหรือ session
    sourceData[userId] = source;
    console.log(`บันทึก Source: ${source} สำหรับ userId: ${userId}`);
    
    // เปลี่ยนเส้นทางไปที่ LINE
    const lineUrl = `https://line.me/R/ti/p/%40yourlineid`;  // เปลี่ยนเป็น ID ของบอท
    res.redirect(lineUrl);
  } else {
    res.status(400).send("Missing source parameter.");
  }
});

module.exports = router;
