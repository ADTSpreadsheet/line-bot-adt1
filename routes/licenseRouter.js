const express = require('express');
const router = express.Router();

const { checkMachineID } = require('../controllers/checkMachineController');

//------------------------------------------------------------
// POST /router/license/check-machine
// ตรวจสอบ Machine ID จากฝั่ง VBA
//------------------------------------------------------------
router.post('/check-machine', checkMachineID);

module.exports = router;
