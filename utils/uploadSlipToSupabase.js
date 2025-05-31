const { supabase } = require('./supabaseClient');

const uploadBase64ImageToSupabase = async ({ base64String, fileName, bucket }) => {
  try {
    console.log('🚀 เริ่มอัพโหลดไฟล์:', fileName, 'ไปยัง bucket:', bucket);
    
    // 🔍 ตรวจสอบ input parameters
    if (!base64String || !fileName || !bucket) {
      console.error('❌ ข้อมูลไม่ครบ:', { base64String: !!base64String, fileName, bucket });
      return { success: false, error: { message: 'ข้อมูลไม่ครบสำหรับการอัพโหลด' } };
    }

    // 🔍 ตัด prefix "data:image/jpeg;base64," ออก (ถ้ามี)
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // ตรวจสอบว่า base64 ถูกต้องหรือไม่
    if (!base64Data || base64Data.length === 0) {
      console.error('❌ Base64 string ไม่ถูกต้อง');
      return { success: false, error: { message: 'Base64 string ไม่ถูกต้อง' } };
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');
    console.log('📊 ขนาดไฟล์:', fileBuffer.length, 'bytes');

    // 📤 อัปโหลดไฟล์เข้า Storage
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });

    // ❌ กรณีอัปโหลดไม่สำเร็จ
    if (error) {
      console.error('❌ Upload fail:', error);
      return { success: false, error };
    }

    console.log('✅ อัพโหลดสำเร็จ:', data);

    // ✅ สร้าง public URL สำหรับเรียกใช้ภาพ (แก้ไขจุดนี้)
    const { data: urlData } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 Public URL:', publicUrl);

    return {
      success: true,
      publicUrl,
      path: data.path
    };

  } catch (err) {
    console.error('❌ ERROR during uploadBase64ImageToSupabase:', err);
    return { success: false, error: err };
  }
};

module.exports = { uploadBase64ImageToSupabase };
