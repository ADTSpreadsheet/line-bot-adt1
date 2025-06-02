// controllers/OrderApproved.js

const axios = require('axios');

const handleOrderApproved = async (event) => {
  try {
    const data = event.postback.data;
    const params = new URLSearchParams(data);

    const action = params.get('action'); // 'approve' หรืออื่น ๆ
    const refCode = params.get('ref_code');
    const licenseNo = params.get('license_no');
    const serialKey = params.get('serial_key');

    if (action !== 'approve') {
      console.log('📌 ข้าม postback นี้ เพราะไม่ใช่ approve');
      return;
    }

    // ✅ ยิง POST ไป API1
    await axios.post('https://line-bot-adt.onrender.com/notify-customer', {
      ref_code: refCode,
      license_no: licenseNo,
      serial_key: serialKey
    });

    console.log(`✅ POST กลับไปยัง API1 สำเร็จ → Ref: ${refCode}`);
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดใน handleOrderApproved:', err.message);
  }
};

module.exports = handleOrderApproved;
