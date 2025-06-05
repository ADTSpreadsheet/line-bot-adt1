const loginStarter = require('./logics/loginStarter');
const loginPro = require('./logics/loginPro');

async function adtLoginController(req, res) {
  const { username, password } = req.body;

  // ตรวจสอบ input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุ Username และ Password',
    });
  }

  // ตรวจสอบประเภท Username
  if (username.startsWith('ADT-')) {
    // เป็น Starter Plan (เช่น ADT-3D-XXXX)
    return await loginStarter(username, password, res);
  } else if (/^ADT\d+$/.test(username)) {
    // เป็น Professional Plan (เช่น ADT152)
    return await loginPro(username, password, res);
  } else {
    return res.status(400).json({
      success: false,
      message: 'รูปแบบ Username ไม่ถูกต้อง',
    });
  }
}

module.exports = adtLoginController;
