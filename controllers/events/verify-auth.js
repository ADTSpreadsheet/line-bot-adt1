const { supabase } = require('../../utils/supabaseClient');

// ===== VERIFY AUTH FUNCTION =====
const verifyAuth = async (req, res) => {
    try {
        const { ref_code, serial_key } = req.body;

        // Basic validation
        if (!ref_code || !serial_key) {
            console.log('❌ [verify-auth] Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'ref_code และ serial_key จำเป็นต้องระบุ'
            });
        }

        // Clean input data
        const cleanRefCode = ref_code.toString().trim();
        const cleanSerialKey = serial_key.toString().trim();

        console.log(`🔍 [verify-auth] Checking - ref_code: ${cleanRefCode}, serial_key: ${cleanSerialKey}`);

        // Check if auth session exists in Supabase
        const { data: authSessions, error: selectError } = await supabase
            .from('auth_sessions')
            .select('id, ref_code, serial_key, status')
            .eq('ref_code', cleanRefCode)
            .eq('serial_key', cleanSerialKey);

        if (selectError) {
            console.error(`❌ [verify-auth] Database select error:`, selectError);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูล'
            });
        }

        if (!authSessions || authSessions.length === 0) {
            console.log(`❌ [verify-auth] Not found - ref_code: ${cleanRefCode}, serial_key: ${cleanSerialKey}`);
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการยืนยันตัวตน'
            });
        }

        const authSession = authSessions[0];
        console.log(`✅ [verify-auth] Found session - ID: ${authSession.id}, Current status: ${authSession.status}`);

        // Update status to 'Active'
        const { data: updateData, error: updateError } = await supabase
            .from('auth_sessions')
            .update({ 
                status: 'Active',
                updated_at: new Date().toISOString()
            })
            .eq('id', authSession.id)
            .select();

        if (updateError) {
            console.error(`❌ [verify-auth] Database update error:`, updateError);
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถอัพเดทสถานะได้'
            });
        }

        if (!updateData || updateData.length === 0) {
            console.log(`⚠️ [verify-auth] No rows updated - Session ID: ${authSession.id}`);
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถอัพเดทสถานะได้'
            });
        }

        console.log(`✅ [verify-auth] Status updated to Active - Session ID: ${authSession.id}`);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'ยืนยันตัวตนสำเร็จ',
            data: {
                session_id: authSession.id,
                ref_code: cleanRefCode,
                status: 'Active',
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ [verify-auth] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในระบบ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===== TEST SUPABASE CONNECTION =====
const testSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('auth_sessions')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error(`❌ [verify-auth] Supabase connection failed:`, error.message);
            return false;
        }
        
        console.log(`✅ [verify-auth] Supabase connected successfully`);
        return true;
    } catch (error) {
        console.error(`❌ [verify-auth] Supabase connection failed:`, error.message);
        return false;
    }
};

// Test connection on module load
testSupabaseConnection();

module.exports = {
    verifyAuth,
    testSupabaseConnection
};
