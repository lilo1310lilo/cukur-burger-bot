const { Telegraf, session, Scenes } = require('telegraf');
const { OWNER_ID } = require('./config');

// Handlerlarni import qilish
const { startHandler } = require('./handlers/start');
const { ownerHandler } = require('./handlers/owner');
const { menuHandler, menuScenes } = require('./handlers/admin/menu');
const { settingsHandler, settingsScenes } = require('./handlers/admin/settings');
const { statsHandler } = require('./handlers/admin/stats');
const { ordersHandler } = require('./handlers/manager/orders');
const { scheduleHandler, scheduleScenes } = require('./handlers/manager/schedule');
const { checkRole } = require('./middleware/auth');
const { setBotInstance } = require('./services/notifications');

// Bot yaratish
const bot = new Telegraf(process.env.BOT_TOKEN);

// Session middleware
bot.use(session());

// Barcha scenalarni birlashtirish
const stage = new Scenes.Stage([
  ...menuScenes,
  ...settingsScenes,
  ...scheduleScenes,
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
bot.hears('📊 Statistika', checkRole(['owner', 'admin']), statsHandler.showStats);

// ─── MANAGER HANDLERLAR ──────────────────────────────
bot.hears('📦 Buyurtmalar', checkRole(['owner', 'admin', 'manager']), ordersHandler.showActiveOrders);
bot.hears('🕐 Ish vaqti', checkRole(['owner', 'admin', 'manager']), scheduleHandler.showSchedule);

// ─── CALLBACK QUERY (inline tugmalar) ────────────────
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Buyurtma callback lari
  if (data.startsWith('order_')) {
    return ordersHandler.handleCallback(ctx);
  }
  // Menyu callback lari
  if (data.startsWith('menu_') || data.startsWith('cat_')) {
    return menuHandler.handleCallback(ctx);
  }
  // Jadval callback lari
  if (data.startsWith('sched_')) {
    return scheduleHandler.handleCallback(ctx);
  }
  // Sozlamalar callback lari
  if (data.startsWith('set_')) {
    return settingsHandler.handleCallback(ctx);
  }
  // Statistika callback lari
  if (data.startsWith('stats_')) {
    return statsHandler.handleCallback(ctx);
  }

  await ctx.answerCbQuery();
});

// ─── GLOBAL TEXT HANDLER ────────────────────────────
bot.on('text', async (ctx, next) => {
  // Scene ichida bo'lsa — o'tkazib yuborish
  if (ctx.scene?.current) return next();

  // Menu text input tekshirish
  if (await menuHandler.handleTextInput(ctx)) return;
  // Settings text input tekshirish
  if (await settingsHandler.handleTextInput(ctx)) return;
  // Schedule text input tekshirish
  if (await scheduleHandler.handleTextInput(ctx)) return;

  return next();
});

// ─── GLOBAL PHOTO HANDLER ────────────────────────────
bot.on('photo', async (ctx, next) => {
  if (ctx.scene?.current) return next();
  if (await menuHandler.handlePhotoInput(ctx)) return;
  return next();
});

// ─── GLOBAL DOCUMENT HANDLER ────────────────────────
bot.on('document', async (ctx, next) => {
  if (ctx.scene?.current) return next();
  if (await menuHandler.handlePhotoInput(ctx)) return;
  return next();
});

// Xato handler
bot.catch((err, ctx) => {
  console.error(`❌ Bot xatosi [${ctx.updateType}]:`, err.message);
});

// Bot instance ni notification service ga o'rnatish
setBotInstance(bot);

module.exports = { bot };
