const express = require('express');
const router = express.Router();

// เรียก controller ที่พี่สร้างไว้
const handleFullPurchase = require('../controllers/handleFullPurchase');

// POST route สำหรับรับข้อมูลจากฟอร์มหน้าเว็บ
router.post('/adt/order', handleFullPurchase);

module.exports = router;
