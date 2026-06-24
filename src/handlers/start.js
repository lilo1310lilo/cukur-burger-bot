const { Markup } = require('telegraf');
const { getBotUser, addBotUser } = require('../db');
const { OWNER_ID } = require('../config');

// Rol asosida klaviatura
function getKeyboard(role) {
  if (role === 'owner' || role === 'admin') {
    return Markup.keyboard([
      ['📋 Menyu', '🗂 Kategoriyalar'],
      ['🍱 Kombolar', '⚙️ Sozlamalar'],
      ['🎟 Kuponlar', '📊 Statistika'],
      ['📦 Buyurtmalar', '🕐 Ish vaqti'],
      ['👥 Foydalanuvchilar'],
    ]).resize();
  }
  if (role === 'manager') {
    return Markup.keyboard([
      ['📦 Buyurtmalar'],
      ['🕐 Ish vaqti'],
    ]).resize();
  }
  return Markup.removeKeyboard();
}

async function startHandler(ctx) {
  const userId = ctx.from.id;
  const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();
  const username = ctx.from.username || '';

  try {
    // Owner bo'lsa, avtomatik qo'shish
    if (userId === OWNER_ID) {
      await addBotUser(userId, 'owner', name, username);
      return ctx.reply(
        `👑 Xush kelibsiz, Owner!\n\n🍔 <b>Çukur Burger Bot</b> — boshqaruv paneli\n\nQuyidagi bo'limlardan foydalaning:`,
        { parse_mode: 'HTML', ...getKeyboard('owner') }
      );
    }

    // Boshqa foydalanuvchi
    const user = await getBotUser(userId);
    if (!user || !user.is_active) {
      return ctx.reply(
        `⛔ Siz bu botdan foydalanish huquqiga ega emassiz.\n\n` +
        `Agar siz kafe xodimi bo'lsangiz, bot egasiga murojaat qiling.\n` +
        `Sizning ID: <code>${userId}</code>`,
        { parse_mode: 'HTML' }
      );
    }

    // Update user info
    await addBotUser(userId, user.role, name, username);

    const roleLabel = user.role === 'admin' ? '👨‍💼 Admin' : '👨‍🔧 Manager';
    return ctx.reply(
      `${roleLabel} sifatida xush kelibsiz, ${name}!\n\n🍔 <b>Çukur Burger Bot</b>`,
      { parse_mode: 'HTML', ...getKeyboard(user.role) }
    );
  } catch (err) {
    console.error('Start xatosi:', err.message);
    ctx.reply('❌ Xatolik yuz berdi.');
  }
}

module.exports = { startHandler, getKeyboard };
