// routes/pdpaText.js

const express = require('express');
const router = express.Router();

// ข้อความ PDPA
const pdpaText = `
    		ในเงื่อนไข/ข้อตกลงต่อไปนี้ ให้ผู้เข้าใช้งานโปรแกรมทำความเข้าใจอย่างละเอียดและผู้เข้าใช้งานโปรแกรม ADTSpreadsheet ต้องปฏิบัติ/และยินยอมตามข้อตกลงในเอกสารฉบับนี้ทุกประการซึ่งต่อไปนี้คือเนื้อหาใจความสำคัญสำหรับการทำตกลงระหว่างผู้ใช้โปรแกรมและผู้พัฒนาโปรแกรมดังนี้
      
ข้อที่ 1 :	โปรแกรม ADTSpreadsheet เป็นโปรแกรมที่ถูกพัฒนาขึ้นมาจากโปรแกรม Software พื้นฐาน อย่างเช่น Microsoft Office Excel ที่นำแหละความรู้ทางวิศวกรรมออกแบบ ประกอบกับคำสั่งพื้นฐาน และการใช้ Microsoft Visual Basic For Applications ประกอบกันให้เป็นชุดโปรแกรมที่มีความสามารถในการจัดทำเอกสารรายการคำนวณหรือเอกสารทางวิศวกรรมในหลายๆด้านซึ่ง ADTSpreadsheetถือเป็นโปรแกรมช่วยให้วิศวกรหรือผู้ที่ใช้โปรแกรมได้มีข้อมูลหรือเอกสารสำหรับการตัดสินใจหรือออกแบบทางวิศวกรรมได้อย่างลงตัว โดยอาศัยดุลยพินิจย์ของผู้ใช้เอง

ข้อที่ 2 :	ผู้เข้าใช้งานโปรแกรมเป็นผู้ดำเนินการกรอกข้อมูลสำหรับการดำเนินการลงทะเบียนเข้าใช้งานโปรแกรมด้วยตนเอง ไม่ว่าจะเป็นข้อมูลชื่อ-นามสกุล ที่อยู่เบอร์โทรศัพท์ e-mail address  หรือข้อมูลสำคัญส่วนอื่นๆตามแบบฟอร์มการลงทะเบียนปรากฏ ซึ่งล้วนแล้วแต่เป็นข้อมูลจริงทั้งสิ้น หากผู้เข้าใช้งานได้ดำเนินการกรอกข้อมูลอันเป็นเท็จ ผู้พัฒนาโปรแกรมมีสิทธิ์ที่จะบล็อกการเข้าใช้งานโปรแกรม ADTSpreadsheet ทุกกรณีโดยไม่จำเป็นต้องดำเนินการแจ้งให้ท่านทราบล่วงหน้า

ข้อที่ 3 :	ผู้เข้าใช้งานโปรแกรมคือผู้รับผิดชอบต่อการจัดทำเอกสารรายการคำนวณหรือเอกสารทางวิศวกรรมที่เกิดจากการใช้โปรแกรม ADTSpreadsheet  ทั้งหมดซึ่งหากมีข้อผิดพลาดที่ไม่ได้เกิดจากโปรแกรมผู้ใช้งานโปรแกรมเป็นผู้รับผิดชอบต่อกรณีพิพาทที่เกิดขึ้นทั้งหมดแต่เพียงผู้เดียว

ข้อที่ 4 :	ผู้เข้าใช้งานโปรแกรม ไม่ว่าจะเป็นผู้ที่ได้รับสิทธิ์ทดลองใช้งานฟรี หรือผู้ที่ได้รับสิทธิ์ใช้งานโดยชำระค่าลิขสิทธิ์แล้วก็ตาม ตกลงว่าจะไม่ทำการดัดแปลง แก้ไข คัดลอก หรือเปลี่ยนแปลงโครงสร้างใด ๆ ของโปรแกรม ADTSpreadsheet อันอาจนำไปสู่ความเข้าใจผิด การโต้แย้ง วิพากษ์วิจารณ์ หรือทำให้เกิดความเสียหายต่อชื่อเสียงภาพลักษณ์หรือความน่าเชื่อถือของโปรแกรม ADTSpreadsheetและ/หรือผู้พัฒนาไม่ว่าทางตรงหรือทางอ้อม

ข้อที่ 5 :	หากตรวจพบว่าผู้เข้าใช้งานโปรแกรมไม่ว่าจะอยู่ในสถานะทดลองใช้งาน หรือได้รับสิทธิ์การใช้งานโดยชำระค่าลิขสิทธิ์แล้วก็ตาม ได้มีพฤติกรรมที่เข้าข่ายการพยายามโจมตีระบบ ทำลายความมั่นคงของโปรแกรม หรือกระทำการใด ๆ อันเป็นการทุจริตหรือไม่สุจริตต่อการเข้าใช้งานโปรแกรม ADTSpreadsheetผู้พัฒนาขอสงวนสิทธิ์ในการ ปิดกั้นการเข้าถึงโปรแกรมหรือยกเลิกสิทธิ์การใช้งานทันทีโดยไม่จำเป็นต้องแจ้งล่วงหน้าและถือว่าการบริการหลังการขายการอัปเกรดระบบหรือการดูแลใดๆทั้งสิ้นจะสิ้นสุดโดยอัตโนมัติในทุกกรณี

ข้อที่ 6 :	การลงทะเบียนเพื่อขอสิทธิ์ใช้งานโปรแกรม ADTSpreadsheet ในช่วงทดลองใช้งาน 7 วัน จะเริ่มนับจากวันที่ลงทะเบียนสำเร็จเป็นวันแรก โดยผู้ใช้งานจะได้รับสิทธิ์ในการใช้งาน 1 User ID ต่อ 1 เครื่อง เท่านั้นหากตรวจพบว่ามีความพยายามใช้งานในหลายเครื่องภายในช่วงระยะเวลา 7 วัน โดยใช้ UserID เดียวกัน ผู้พัฒนาขอสงวนสิทธิ์ในการปิดกั้นการเข้าถึงโปรแกรมทันทีโดยไม่จำเป็นต้องแจ้งให้ทราบล่วงหน้า

ข้อที่ 7 :	ผู้ใช้งานยินยอมให้ผู้พัฒนาโปรแกรมจัดเก็บและประมวลผลข้อมูลส่วนบุคคลที่จำเป็นสำหรับการระบุตัวตนในช่วงระยะเวลาทดลองใช้งาน 7 วัน ซึ่งรวมถึงข้อมูล ชื่อ–นามสกุล, หมายเลขโทรศัพท์, ที่อยู่, หมายเลขบัตรประจำตัวประชาชน, LINE ID, IP Address และ Machine ID โดยข้อมูลดังกล่าวจะถูกใช้เฉพาะเพื่อวัตถุประสงค์ในการควบคุมสิทธิ์การใช้งานภายในโปรแกรม ADTSpreadsheet เท่านั้น และจะไม่มีการนำไปเผยแพร่หรือใช้ในเชิงพาณิชย์โดยมิได้รับความยินยอมจากเจ้าของข้อมูล

ข้อที่ 8 :	การบริการหลังการขายครอบคลุมเฉพาะปัญหาที่เกี่ยวข้องกับการทำงานของโปรแกรม ADTSpreadsheet เท่านั้น  ผู้พัฒนาไม่มีภาระผูกพันในการแก้ไขปัญหาที่เกิดจากสภาพแวดล้อมของผู้ใช้งานเช่นการติดตั้งโปรแกรม Microsoft Excel ไม่สมบูรณ์, ฟอนต์ระบบหาย, การตั้งค่าเครื่องคอมพิวเตอร์ผิดพลาดหรือการเชื่อมต่ออินเทอร์เน็ต/ระบบเครือข่าย หากผู้ใช้งานต้องการให้ผู้พัฒนาช่วยเหลือในปัญหาที่อยู่นอกเหนือจากตัวโปรแกรมอาจมีค่าบริการเพิ่มเติมตามสมควรและผู้พัฒนาขอสงวนสิทธิ์ในการให้บริการในกรณีที่ไม่เกี่ยวข้องกับโปรแกรมโดยตรง

`;

// ส่งข้อความ PDPA
router.get('/pdpa-text', (req, res) => {
    res.type('text/plain; charset=utf-8');
    res.send(pdpaText);
});

module.exports = router;
