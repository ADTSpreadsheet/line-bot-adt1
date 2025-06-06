// routes/forgetID.js
const express = require('express');
const router = express.Router();
const forgetIDController = require('../controllers/logics/forgetID');

// POST /api/forget-id
router.post('/', forgetIDController);

module.exports = router;
