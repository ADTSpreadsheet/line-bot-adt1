// 📁 ชื่อไฟล์: routes/registerSession.js

const express = require("express");
const router = express.Router();
const supabase = require("../utils/supabaseClient");

router.post("/register-session", async (req, res) => {
  try {
    const data = req.body;

    // ✅ ตรวจสอบว่าข้อมูลที่จำเป็นถูกส่งมาครบ
    if (!data.line_user_id || !data.ref_code || !data.machine_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ✅ แทรกข้อมูลลงใน Supabase
    const { error } = await supabase.from("auth_sessions").insert([
      {
        line_user_id: data.line_user_id,
        ref_code: data.ref_code,
        serial_key: data.serial_key,
        day_created_at: data.day_created_at,
        time_created_at: data.time_created_at,
        request_count: data.request_count,
        otp: data.otp,
        verify_count: data.verify_count,
        verify_at: data.verify_at,
        expires_at: data.expires_at,
        status: data.status,
        updated_at: data.updated_at,
        failed_attempt: data.failed_attempt,
        machine_id: data.machine_id,
        gender: data.gender,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname,
        age: data.age,
        occupation: data.occupation,
        national_id: data.national_id,
        house_number: data.house_number,
        district: data.district,
        province: data.province,
        postal_code: data.postal_code,
        phone_number: data.phone_number,
        email: data.email,
        facebook_url: data.facebook_url,
        line_id: data.line_id,
        ip_address: data.ip_address,
        line_contact_name: data.line_contact_name
      }
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ message: "Insert failed", error });
    }

    res.status(200).json({ message: "Registration saved successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ message: "Unexpected error", error });
  }
});

module.exports = router;
