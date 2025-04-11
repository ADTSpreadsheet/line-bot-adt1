const express = require('express');
const router = express.Router();

+ const { checkMachineStatus } = require('../controllers/checkMachineController');

//------------------------------------------------------------
// POST /router/license/check-machine
// ตรวจสอบ Machine ID จากฝั่ง VBA
//------------------------------------------------------------
router.post('/check-machine', checkMachineStatus);

module.exports = router;
