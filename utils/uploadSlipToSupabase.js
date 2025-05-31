const { supabase } = require('./supabaseClient'); // ปรับ path ให้ถูกด้วยนะครับ

const uploadBase64ImageToSupabase = async ({ base64String, fileName, bucket }) => {
  try {
    // 🔍 ตัด prefix "data:image/jpeg;base64," ออก (ถ้ามี)
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // 📤 อัปโหลดไฟล์เข้า Storage
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    // ❌ กรณีอัปโหลดไม่สำเร็จ
    if (error) {
      console.error('❌ Upload fail:', error.message);
      return { success: false, error };
    }

    // ✅ สร้าง public URL สำหรับเรียกใช้ภาพ
    const publicUrl = supabase
      .storage
      .from(bucket)
      .getPublicUrl(data.path).publicURL;

    return {
      success: true,
      publicUrl
    };

  } catch (err) {
    console.error('❌ ERROR during uploadBase64ImageToSupabase:', err);
    return { success: false, error: err };
  }
};

module.exports = { uploadBase64ImageToSupabase };
