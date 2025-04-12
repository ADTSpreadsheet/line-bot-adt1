const express = require('express');
const router = express.Router();
const { setupPassword } = require('../controllers/setupPasswordController');

// Endpoint: /router/setup-password
router.post('/setup-password', setupPassword);

module.exports = router;
