# ADT LINE Bot

ระบบ LINE Bot สำหรับการยืนยันตัวตนผ่าน VBA Form ด้วย Ref.Code และ Serial Key

## คุณสมบัติ

- รองรับการทำงานร่วมกับ LINE Messaging API
- สร้างและตรวจสอบ Ref.Code และ Serial Key
- เชื่อมต่อกับฐานข้อมูล Supabase
- แจ้งเตือนเมื่อมีผู้ใช้ลงทะเบียนเสร็จสมบูรณ์

## การติดตั้ง

1. ติดตั้ง dependencies:
```bash
npm install
2. ตั้งค่า environment variables ในไฟล์ .env:
```bash
LINE_BOT1_ACCESS_TOKEN=your_bot1_token
LINE_BOT1_CHANNEL_SECRET=your_bot1_secret
LINE_BOT2_ACCESS_TOKEN=your_bot2_token
LINE_BOT2_CHANNEL_SECRET=your_bot2_secret
LINE_BOT1_ID=your_bot1_id
LINE_BOT2_ID=your_bot2_id
ADMIN_USER_ID=your_line_user_id
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
PORT=3000
3. รันเซิร์ฟเวอร์
node index.js
