const express = require('express');
const router = express.Router();

const loginController = require('../controllers/loginController');

// ✅ เส้นทางสำหรับตรวจสอบ Username และ Password
router.post('/login', loginController.login);

module.exports = router;
