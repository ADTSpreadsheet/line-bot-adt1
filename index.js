/**
 * index.js
 * จุดเริ่มต้นของระบบ LINE Bot + Supabase + Excel VBA
 */

require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const CONFIG = require('./config');

const app = express();
const PORT = CONFIG.PORT || 10000;

// Middleware
app.use(express.json());

// Routes
app.use('/', routes);

// Root route (optional)
app.get('/', (req, res) => {
  res.send('🎉 ADT LINE Bot Server is running!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌐 Webhook URL: https://line-bot-adt.onrender.com/webhook`);
});
