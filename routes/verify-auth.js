const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../controllers/events/verify-auth');

// POST /verify-auth
router.post('/', verifyAuth);

module.exports = router;
