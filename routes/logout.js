const express = require('express');
const router = express.Router();

const logoutController = require('../controllers/logics/logout');

// POST /api/logout
router.post('/logout', logoutController);

module.exports = router;
