router.post('/get-message', async (req, res) => {
  const { lineUserId } = req.body;

  // ข้อความเริ่มต้น (default ทุกเคส)
  const responseMessage = {
    stage1: 'กรุณาพิมพ์ข้อความ REQ_REFCODE ในแชทไลน์เพื่อขอรับ รหัส Ref.Code',
    stage2: '',
    stage3: ''
  };

  // ถ้ายังไม่มี lineUserId → ส่งข้อความเริ่มต้นไปเลย
  if (!lineUserId) {
    return res.status(200).json({
      success: true,
      message: responseMessage
    });
  }

  // ถ้ามี lineUserId → ค่อยดึงข้อมูลจาก Supabase ตามปกติ
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('status, ref_code, serial_key, expires_at')
    .eq('line_user_id', lineUserId)
    .single();

  if (error || !data) {
    return res.status(200).json({
      success: true,
      message: {
        ...responseMessage,
        stage3: 'ยังไม่พบข้อมูลการลงทะเบียน กรุณาพิมพ์ REQ_REFCODE ใหม่อีกครั้ง'
      }
    });
  }

  // ถ้าพบข้อมูล → คำนวณ countdown
  const { ref_code, serial_key, status, expires_at } = data;
  const remainingTime = new Date(expires_at) - new Date();

  if (remainingTime <= 0) {
    return res.status(200).json({
      success: true,
      message: {
        ...responseMessage,
        stage3: '❌ รหัส Serial Key ของท่านหมดอายุแล้ว'
      }
    });
  }

  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  const countdownMessage = `⏳ รหัส Serial Key ของท่านจะหมดอายุภายใน ${minutes} นาที ${seconds} วินาที`;

  // ตอบกลับแบบเต็ม
  return res.status(200).json({
    success: true,
    message: {
      ...responseMessage,
      ref_code,
      serial_key,
      stage2: 'กรุณากรอกรหัส Ref.Code ของท่านและกดปุ่ม Verify Code',
      stage3: countdownMessage
    }
  });
});
