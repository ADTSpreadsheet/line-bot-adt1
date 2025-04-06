const express = require('express');
const router = express.Router();

const { confirmOtp } = require('../controllers/confirmOtpController');
const { validateBody } = require('../middlewares/validator');

router.post('/', validateBody(['ref_code', 'otp']), confirmOtp);

module.exports = router;
