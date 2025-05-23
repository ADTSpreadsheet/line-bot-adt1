const express = require('express');
const router = express.Router();

const { handlePublicWorkshopRegister } = require('../controllers/publicWorkshopRegister');

// 🔹 Endpoint สำหรับบุคคลทั่วไป
router.post('/adtliveworkshop/public-register', handlePublicWorkshopRegister);

module.exports = router;
