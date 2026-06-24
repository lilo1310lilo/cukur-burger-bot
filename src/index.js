require('dotenv').config();
const express = require('express');
const { bot } = require('./bot');
const { startNotificationService } = require('./services/notifications');
const { initWebPush, isWebPushEnabled } = require('./services/webpush');
const { supabase } = require('./db');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const startedAt = Date.now();

// Health check — boyitilgan
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    time: new Date().toISOString(),
    uptime_sec: Math.floor((Date.now() - startedAt) / 1000),
    webhook_configured: Boolean(WEBHOOK_URL),
    web_push: isWebPushEnabled() ? 'enabled' : 'disabled',
    supabase: 'unknown',
  };
  // Supabase ulanishini yengil tekshirish
  try {
    const { error } = await supabase.from('site_settings').select('key').limit(1);
    health.supabase = error ? 'error' : 'ok';
    if (error) health.status = 'degraded';
  } catch {
    health.supabase = 'error';
    health.status = 'degraded';
  }
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Telegram webhook endpoint
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

async function start() {
  try {
    if (!BOT_TOKEN) throw new Error('BOT_TOKEN .env da yo\'q!');
    if (!WEBHOOK_URL) throw new Error('WEBHOOK_URL .env da yo\'q!');

    // Web Push ni sozlash (VAPID kalitlari bo'lsa)
    initWebPush();

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
