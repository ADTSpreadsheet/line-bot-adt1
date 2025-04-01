// db/postgres.js

const { Pool } = require('pg');  // ใช้ pg library เพื่อเชื่อมต่อ PostgreSQL

// สร้าง pool สำหรับการเชื่อมต่อ
const pool = new Pool({
  user: process.env.PG_USER,      // ตั้งค่าจาก .env
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,      // ปกติคือ 5432
});

// ใช้ pool ในการ query ข้อมูล
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to database:', res.rows[0]);
  }
});

// ส่งออก pool สำหรับใช้งานในไฟล์อื่น ๆ
module.exports = { pool };
