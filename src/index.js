require('dotenv').config();
const express = require('express');
const { bot } = require('./bot');
const { startNotificationService } = require('./services/notifications');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Telegram webhook endpoint
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

async function start() {
  try {
    if (!BOT_TOKEN) throw new Error('BOT_TOKEN .env da yo\'q!');
    if (!WEBHOOK_URL) throw new Error('WEBHOOK_URL .env da yo\'q!');

    // Eski webhookni o'chirish
    await bot.telegram.deleteWebhook();

    // Yangi webhook o'rnatish
    const webhookPath = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookPath);
    console.log(`✅ Webhook o'rnatildi: ${webhookPath}`);

    // Server ishga tushirish
    app.listen(PORT, () => {
      console.log(`🚀 Server ishlayapti: port ${PORT}`);
    });

    // Supabase realtime — yangi buyurtmalarni kuzatish
    startNotificationService();
    console.log('🔔 Notification service ishga tushdi');

    console.log('🍔 Çukur Burger Bot tayyor!');
  } catch (err) {
    console.error('❌ Start xatosi:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start();
