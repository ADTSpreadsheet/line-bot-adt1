// routes/orderApprovedRoutes.js

const express = require('express');
const router = express.Router();
const handleOrderApproved = require('../controllers/OrderApproved'); // เรียกจาก controller ที่พี่ตั้งชื่อไว้

router.post('/notify-customer', async (req, res) => {
  try {
    // 模拟 event object เหมือนที่ได้จาก LINE postback event
    const fakeEvent = {
      postback: {
        data: `action=approve&ref_code=${req.body.ref_code}&license_no=${req.body.license_no}&serial_key=${req.body.serial_key}`
      }
    };

    // เรียก controller ที่จัดการ logic
    await handleOrderApproved(fakeEvent);

    res.status(200).json({ message: '✅ แจ้งลูกค้าสำเร็จ' });
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดใน /notify-customer:', error.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: error.message });
  }
});

module.exports = router;
