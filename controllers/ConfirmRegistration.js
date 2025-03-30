const express = require('express');
const router = express.Router();
const confirmRegistrationController = require('../controllers/ConfirmRegistration');

router.post('/verify-refcode', confirmRegistrationController.verifyRefCode);
router.post('/verify-serialkey', confirmRegistrationController.verifySerialKey);
router.post('/complete-registration', confirmRegistrationController.completeRegistration);
router.post('/resend-serialkey', confirmRegistrationController.resendSerialKey);
router.get('/check-status/:refCode', confirmRegistrationController.checkRegistrationStatus);

module.exports = router;
