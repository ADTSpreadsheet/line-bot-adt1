const supabase = require('../config/supabaseClient');
const { toThaiTime } = require('../utils/timeUtils');

/**
 * ยืนยัน Ref Code และส่ง Serial Key
 */
const verifyRefCode = async (req, res) => {
  const { refCode } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'รหัสอ้างอิงหมดอายุ หรือไม่ถูกต้อง' });
    }

    // อัปเดตสถานะและเวลาที่กดยืนยัน
    const thaiNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        status: 'VERIFIED',
        verify_count: data.verify_count + 1,
        verify_at: thaiNow.toISOString(),
        updated_at: thaiNow.toISOString()
      })
      .eq('id', data.id);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      message: 'ยืนยัน Ref Code สำเร็จ',
      serialKey: data.serial_key,
      createdAtThai: toThaiTime(data.day_created_at, data.time_created_at),
      verifyAtThai: toThaiTime(thaiNow),
      expiresAtThai: toThaiTime(data.expires_at)
    });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยืนยัน Ref Code', error: err.message });
  }
};

/**
 * ตรวจสอบ Serial Key ว่ายังใช้งานได้หรือไม่
 */
const verifySerialKey = async (req, res) => {
  const { serialKey } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('serial_key', serialKey)
      .eq('status', 'VERIFIED')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Serial Key ไม่ถูกต้อง หรือหมดอายุแล้ว' });
    }

    res.status(200).json({
      message: 'Serial Key ถูกต้อง',
      serialKey: data.serial_key,
      createdAtThai: toThaiTime(data.day_created_at, data.time_created_at),
      verifyAtThai: toThaiTime(data.verify_at),
      expiresAtThai: toThaiTime(data.expires_at)
    });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ Serial Key', error: err.message });
  }
};

/**
 * ส่ง Serial Key กลับไปให้ LINE หลังจากผู้ใช้กด Verify แล้ว
 */
const sendSerialKey = async (req, res) => {
  const { refCode } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('status', 'VERIFIED')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการยืนยัน Ref Code นี้' });
    }

    res.status(200).json({
      message: 'ส่ง Serial Key สำเร็จ',
      serialKey: data.serial_key,
      createdAtThai: toThaiTime(data.day_created_at, data.time_created_at),
      verifyAtThai: toThaiTime(data.verify_at),
      expiresAtThai: toThaiTime(data.expires_at)
    });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่ง Serial Key', error: err.message });
  }
};

module.exports = {
  verifyRefCode,
  verifySerialKey,
  sendSerialKey
};
