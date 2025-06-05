const loginStarter = require('./logics/loginStarter');
const loginPro = require('./logics/loginPro');

module.exports = async function adtLoginController(req, res) {
  const { username, password } = req.body;

  // Logic 1: ตรวจสอบ input จาก VBA
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุ Username และ Password',
    });
  }

  // Logic 2: ตรวจสอบรูปแบบ username
  if (username.startsWith('ADT-')) {
    // → Logic 3: ไปเช็คในตาราง starter_plan_users
    return await loginStarter(username, password, res);
  } else if (/^ADT\d+$/.test(username)) {
    // → Logic 4: ไปเช็คในตาราง license_holders
    return await loginPro(username, password, res);
  } else {
    // ไม่เข้าเงื่อนไขใด ๆ
    return res.status(400).json({
      success: false,
      message: 'ไม่พบ Username หรือ password ของคุณ หรือ คุณกรอกข้อมูลไม่ถูกต้อง',
    });
  }
};
