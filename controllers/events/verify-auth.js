const mysql = require('mysql2/promise');

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'adt_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// ===== VERIFY AUTH FUNCTION =====
const verifyAuth = async (req, res) => {
    let connection;
    
    try {
        const { ref_code, serial_key } = req.body;

        // Basic validation
        if (!ref_code || !serial_key) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'ref_code และ serial_key จำเป็นต้องระบุ'
            });
        }

        // Clean input data
        const cleanRefCode = ref_code.toString().trim();
        const cleanSerialKey = serial_key.toString().trim();

        console.log(`🔍 [verify-auth] Checking - ref_code: ${cleanRefCode}, serial_key: ${cleanSerialKey}`);

        // Get database connection
        connection = await pool.getConnection();

        // Check if auth session exists
        const [rows] = await connection.execute(
            'SELECT id, ref_code, serial_key, status FROM auth_sessions WHERE ref_code = ? AND serial_key = ?',
            [cleanRefCode, cleanSerialKey]
        );

        if (rows.length === 0) {
            console.log(`❌ [verify-auth] Not found - ref_code: ${cleanRefCode}, serial_key: ${cleanSerialKey}`);
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการยืนยันตัวตน'
            });
        }

        const authSession = rows[0];
        console.log(`✅ [verify-auth] Found session - ID: ${authSession.id}, Current status: ${authSession.status}`);

        // Update status to 'Active'
        const [updateResult] = await connection.execute(
            'UPDATE auth_sessions SET status = ?, updated_at = NOW() WHERE id = ?',
            ['Active', authSession.id]
        );

        if (updateResult.affectedRows === 0) {
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
        console.error('❌ [verify-auth] Database error:', error);
        return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในระบบฐานข้อมูล',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) {
            connection.release();
            console.log(`🔌 [verify-auth] Database connection released`);
        }
    }
};

// ===== TEST DATABASE CONNECTION =====
const testDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`✅ [verify-auth] Database connected successfully`);
        connection.release();
        return true;
    } catch (error) {
        console.error(`❌ [verify-auth] Database connection failed:`, error.message);
        return false;
    }
};

// Test connection on module load
testDbConnection();

module.exports = {
    verifyAuth,
    testDbConnection
};
