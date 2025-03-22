const supabase = require('../config/supabaseClient');
const { toThaiTime } = require('../utils/timeUtils'); // ✅ นำเข้า

// ฟังก์ชันสร้าง Serial Key
function generateSerialKey() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

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

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Invalid or expired ref code' });
    }

    const serialKey = generateSerialKey();

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({ 
        serial_key: serialKey, 
        status: 'VERIFIED',
        verify_count: data.verify_count + 1,
        verify_at: new Date().toISOString()
      })
      .eq('id', data.id);

    if (updateError) throw updateError;

    res.status(200).json({ 
      message: 'Ref code verified', 
      serialKey: serialKey,
      createdAtThai: toThaiTime(data.created_at),
      expiresAtThai: toThaiTime(data.expires_at),
      verifyAtThai: toThaiTime(new Date().toISOString())
    });

  } catch (error) {
    res.status(500).json({ message: 'Error processing ref code', error: error.message });
  }
};

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

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Invalid or expired serial key' });
    }

    res.status(200).json({ 
      message: 'Serial key verified', 
      serialKey: data.serial_key,
      createdAtThai: toThaiTime(data.created_at),
      expiresAtThai: toThaiTime(data.expires_at),
      verifyAtThai: toThaiTime(data.verify_at)
    });

  } catch (error) {
    res.status(500).json({ message: 'Error verifying serial key', error: error.message });
  }
};

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

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'No verified session found' });
    }

    res.status(200).json({ 
      message: 'Serial key sent successfully',
      serialKey: data.serial_key,
      createdAtThai: toThaiTime(data.created_at),
      expiresAtThai: toThaiTime(data.expires_at),
      verifyAtThai: toThaiTime(data.verify_at)
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
