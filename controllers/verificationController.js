const supabase = require('../config/supabaseClient');
const { toThaiTime } = require('../utils/timeUtils');

// ฟังก์ชัน Verify Ref Code (แค่ยืนยัน ไม่สร้าง Serial Key ใหม่แล้ว)
const verifyRefCode = async (req, res) => {
  const { refCode } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired ref code' });
    }

    const session = data[0];

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        status: 'VERIFIED',
        verify_count: session.verify_count + 1,
        verify_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (updateError) throw updateError;

    res.status(200).json({
      message: 'Ref code verified',
      serialKey: session.serial_key,
      createdAtThai: toThaiTime(session.created_at),
      expiresAtThai: toThaiTime(session.expires_at),
      verifyAtThai: toThaiTime(new Date().toISOString())
    });

  } catch (error) {
    res.status(500).json({ message: 'Error processing ref code', error: error.message });
  }
};

// ฟังก์ชันตรวจ Serial Key
const verifySerialKey = async (req, res) => {
  const { serialKey } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('serial_key', serialKey)
      .eq('status', 'VERIFIED')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired serial key' });
    }

    const session = data[0];

    res.status(200).json({
      message: 'Serial key verified',
      serialKey: session.serial_key,
      createdAtThai: toThaiTime(session.created_at),
      expiresAtThai: toThaiTime(session.expires_at),
      verifyAtThai: toThaiTime(session.verify_at)
    });

  } catch (error) {
    res.status(500).json({ message: 'Error verifying serial key', error: error.message });
  }
};

// ฟังก์ชันส่ง Serial Key ตาม Ref Code (ใช้ใน VBA)
const sendSerialKey = async (req, res) => {
  const { refCode } = req.body;

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('status', 'VERIFIED')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No verified session found' });
    }

    const session = data[0];

    res.status(200).json({
      message: 'Serial key sent successfully',
      serialKey: session.serial_key,
      createdAtThai: toThaiTime(session.created_at),
      expiresAtThai: toThaiTime(session.expires_at),
      verifyAtThai: toThaiTime(session.verify_at)
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error sending Serial Key',
      error: error.message
    });
  }
};

module.exports = {
  verifyRefCode,
  verifySerialKey,
  sendSerialKey
};
