const express = require('express');
const router = express.Router();
const confirmRegistrationController = require('../controllers/ConfirmRegistration');

router.post('/complete-registration', confirmRegistrationController.completeRegistration);

module.exports = router;
