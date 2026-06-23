const { Telegraf, session, Scenes } = require('telegraf');
const { OWNER_ID } = require('./config');

// Handlerlarni import qilish
const { startHandler } = require('./handlers/start');
const { ownerHandler } = require('./handlers/owner');
const { menuHandler, menuScenes } = require('./handlers/admin/menu');
const { settingsHandler, settingsScenes } = require('./handlers/admin/settings');
const { statsHandler } = require('./handlers/admin/stats');
const { couponsHandler, couponScenes } = require('./handlers/admin/coupons');
const { ordersHandler } = require('./handlers/manager/orders');
const { scheduleHandler, scheduleScenes } = require('./handlers/manager/schedule');
const { checkRole } = require('./middleware/auth');
const { rateLimit } = require('./middleware/rateLimit');
const { supabaseSessionStore } = require('./utils/sessionStore');
const { setBotInstance } = require('./services/notifications');

// Bot yaratish
const bot = new Telegraf(process.env.BOT_TOKEN);

// Per-user rate limiting (spam himoyasi) — sessiyadan oldin
bot.use(rateLimit({ windowMs: 1000, max: 6 }));

// Session middleware — Supabase store bilan (restartda yo'qolmaydi)
bot.use(session({ store: supabaseSessionStore }));

// Barcha scenalarni birlashtirish
const stage = new Scenes.Stage([
  ...menuScenes,
  ...settingsScenes,
  ...scheduleScenes,
  ...couponScenes,
]);
bot.use(stage.middleware());

// ─── UMUMIY HANDLERLAR ────────────────────────────────

bot.start(startHandler);

// ─── OWNER HANDLERLAR ────────────────────────────────
bot.command('addadmin', checkRole(['owner']), ownerHandler.addAdmin);
bot.command('removeadmin', checkRole(['owner']), ownerHandler.removeAdmin);
bot.command('addmanager', checkRole(['owner']), ownerHandler.addManager);
bot.command('removemanager', checkRole(['owner']), ownerHandler.removeManager);
bot.command('listusers', checkRole(['owner', 'admin', 'manager']), ownerHandler.listUsers);

// ─── ADMIN HANDLERLAR ────────────────────────────────
bot.hears('📋 Menyu', checkRole(['owner', 'admin']), menuHandler.showMenu);
bot.hears('➕ Taom qo\'shish', checkRole(['owner', 'admin']), menuHandler.startAddItem);
bot.hears('🗂 Kategoriyalar', checkRole(['owner', 'admin']), menuHandler.showCategories);
bot.hears('⚙️ Sozlamalar', checkRole(['owner', 'admin']), settingsHandler.showSettings);
bot.hears('🎟 Kuponlar', checkRole(['owner', 'admin']), couponsHandler.showCoupons);
bot.hears('📊 Statistika', checkRole(['owner', 'admin']), statsHandler.showStats);

// ─── MANAGER HANDLERLAR ──────────────────────────────
bot.hears('📦 Buyurtmalar', checkRole(['owner', 'admin', 'manager']), ordersHandler.showActiveOrders);
bot.hears('🕐 Ish vaqti', checkRole(['owner', 'admin', 'manager']), scheduleHandler.showSchedule);

// ─── CALLBACK QUERY (inline tugmalar) ────────────────
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data || '';

  try {
    // Buyurtma callback lari
    if (data.startsWith('order_')) {
      return await ordersHandler.handleCallback(ctx);
    }
    // Kupon callback lari
    if (data.startsWith('coupon_')) {
      return await couponsHandler.handleCallback(ctx);
    }
    // Menyu callback lari
    if (data.startsWith('menu_') || data.startsWith('cat_')) {
      return await menuHandler.handleCallback(ctx);
    }
    // Jadval callback lari
    if (data.startsWith('sched_')) {
      return await scheduleHandler.handleCallback(ctx);
    }
    // Sozlamalar callback lari
    if (data.startsWith('set_')) {
      return await settingsHandler.handleCallback(ctx);
    }
    // Statistika callback lari
    if (data.startsWith('stats_')) {
      return await statsHandler.handleCallback(ctx);
    }

    await ctx.answerCbQuery();
  } catch (err) {
    console.error(`❌ Callback xatosi [${data}]:`, err.message);
    try { await ctx.answerCbQuery('❌ Xatolik yuz berdi'); } catch {}
    try { await ctx.reply('❌ Amalni bajarishda xatolik yuz berdi. Qaytadan urinib ko\'ring.'); } catch {}
  }
});

// ─── GLOBAL TEXT HANDLER ────────────────────────────
bot.on('text', async (ctx, next) => {
  // Scene ichida bo'lsa — o'tkazib yuborish
  if (ctx.scene?.current) return next();

  try {
    // Menu text input tekshirish
    if (await menuHandler.handleTextInput(ctx)) return;
    // Settings text input tekshirish
    if (await settingsHandler.handleTextInput(ctx)) return;
    // Schedule text input tekshirish
    if (await scheduleHandler.handleTextInput(ctx)) return;
  } catch (err) {
    console.error('❌ Text handler xatosi:', err.message);
    try { await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.'); } catch {}
    return;
  }

  return next();
});

// ─── GLOBAL PHOTO HANDLER ────────────────────────────
bot.on('photo', async (ctx, next) => {
  if (ctx.scene?.current) return next();
  try {
    if (await menuHandler.handlePhotoInput(ctx)) return;
  } catch (err) {
    console.error('❌ Photo handler xatosi:', err.message);
    try { await ctx.reply(`❌ Rasmni qayta ishlashda xatolik: ${err.message}`); } catch {}
    return;
  }
  return next();
});

// ─── GLOBAL DOCUMENT HANDLER ────────────────────────
bot.on('document', async (ctx, next) => {
  if (ctx.scene?.current) return next();
  try {
    if (await menuHandler.handlePhotoInput(ctx)) return;
  } catch (err) {
    console.error('❌ Document handler xatosi:', err.message);
    return;
  }
  return next();
});

// Xato handler — global
bot.catch((err, ctx) => {
  console.error(`❌ Bot xatosi [${ctx.updateType}]:`, err.message);
  try {
    ctx.reply('❌ Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  } catch {}
});

// Bot instance ni notification service ga o'rnatish
setBotInstance(bot);

module.exports = { bot };
