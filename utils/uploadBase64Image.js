const { supabase } = require('./supabaseClient');

/**
 * อัปโหลดรูปภาพจาก base64 string ไปยัง Supabase Storage
 * รูปแบบให้ตรงกับระบบเดิมที่ใช้ใน handleFullPurchase
 * @param {Object} options - ตัวเลือกสำหรับการอัปโหลด
 * @param {string} options.base64String - ข้อมูลรูปภาพในรูปแบบ base64
 * @param {string} options.fileName - ชื่อไฟล์
 * @param {string} options.bucketName - ชื่อ bucket ใน Supabase Storage
 * @param {string} options.folderName - ชื่อโฟลเดอร์ (optional)
 * @returns {Promise<{publicUrl: string, error: null, success: true} | {publicUrl: null, error: string, success: false}>}
 */
const uploadBase64Image = async ({ base64String, fileName, bucketName, folderName = '' }) => {
  try {
    console.log(`📤 เริ่มอัปโหลดไฟล์: ${fileName} ไปยัง bucket: ${bucketName}`);
    
    // ตรวจสอบ input
    if (!base64String || !fileName || !bucketName) {
      throw new Error('ข้อมูลไม่ครบถ้วน: ต้องมี base64String, fileName, และ bucketName');
    }

    // แปลง base64 เป็น buffer
    let buffer;
    let contentType = 'image/jpeg'; // default
    
    try {
      // ตรวจสอบและลบ data URL prefix
      let base64Data = base64String;
      
      if (base64String.startsWith('data:')) {
        const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1]; // เช่น image/jpeg, image/png
          base64Data = matches[2];
        } else {
          // fallback: ลบ prefix แบบง่าย
          base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
        }
      }
      
      buffer = Buffer.from(base64Data, 'base64');
      console.log(`✅ แปลง base64 สำเร็จ: ${buffer.length} bytes, type: ${contentType}`);
      
    } catch (error) {
      throw new Error('ไม่สามารถแปลง base64 string ได้: ' + error.message);
    }

    // ตรวจสอบขนาดไฟล์ (จำกัดที่ 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      throw new Error(`ไฟล์ใหญ่เกินไป: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (จำกัดที่ 10MB)`);
    }

    // สร้าง file path
    const filePath = folderName ? `${folderName}/${fileName}` : fileName;
    console.log(`📁 ไฟล์จะถูกบันทึกที่: ${filePath}`);

    // อัปโหลดไปยัง Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: true // อนุญาตให้เขียนทับไฟล์เดิม
      });

    if (uploadError) {
      console.error('❌ Supabase upload error:', uploadError);
      throw new Error('อัปโหลดไฟล์ล้มเหลว: ' + uploadError.message);
    }

    console.log('✅ อัปโหลดไฟล์สำเร็จ:', data);

    // สร้าง public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('ไม่สามารถสร้าง public URL ได้');
    }

    console.log(`🌐 สร้าง public URL สำเร็จ: ${urlData.publicUrl}`);

    return {
      success: true,  // ✅ เพิ่ม success flag ตาม pattern เดิม
      publicUrl: urlData.publicUrl,
      error: null,
      filePath: filePath,
      fileSize: buffer.length,
      contentType: contentType
    };

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return {
      success: false,  // ✅ เพิ่ม success flag ตาม pattern เดิม
      publicUrl: null,
      error: error.message,
      filePath: null,
      fileSize: 0,
      contentType: null
    };
  }
};

module.exports = uploadBase64Image;
