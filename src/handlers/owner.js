const { Markup } = require('telegraf');
const { getBotUsers, getBotUser, addBotUser, removeBotUser } = require('../db');
const { OWNER_ID } = require('../config');

// /addadmin 123456789
async function addAdmin(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    return ctx.reply('📝 Foydalanish: /addadmin [telegram_id]\nMisol: /addadmin 123456789');
  }
  const targetId = parseInt(parts[1]);
  if (isNaN(targetId)) return ctx.reply('❌ Noto\'g\'ri ID formati.');
  if (targetId === OWNER_ID) return ctx.reply('⛔ Owner rolini o\'zgartirib bo\'lmaydi.');

  try {
    const existing = await getBotUser(targetId);
    await addBotUser(targetId, 'admin', existing?.name || '', existing?.username || '');
    ctx.reply(
      `✅ <b>Admin qo'shildi</b>\n\n` +
      `👤 ID: <code>${targetId}</code>\n` +
      `👑 Rol: Admin\n\n` +
      `Endi u /start buyrug'ini yuborsin.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// /removeadmin 123456789
async function removeAdmin(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    return ctx.reply('📝 Foydalanish: /removeadmin [telegram_id]');
  }
  const targetId = parseInt(parts[1]);
  if (isNaN(targetId)) return ctx.reply('❌ Noto\'g\'ri ID.');
  if (targetId === OWNER_ID) return ctx.reply('⛔ Owner ni o\'chirib bo\'lmaydi.');

  try {
    await removeBotUser(targetId);
    ctx.reply(`✅ ID <code>${targetId}</code> admin huquqi olib tashlandi.`, { parse_mode: 'HTML' });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// /addmanager 123456789
async function addManager(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    return ctx.reply('📝 Foydalanish: /addmanager [telegram_id]\nMisol: /addmanager 123456789');
  }
  const targetId = parseInt(parts[1]);
  if (isNaN(targetId)) return ctx.reply('❌ Noto\'g\'ri ID formati.');
  if (targetId === OWNER_ID) return ctx.reply('⛔ Owner rolini o\'zgartirib bo\'lmaydi.');

  try {
    const existing = await getBotUser(targetId);
    await addBotUser(targetId, 'manager', existing?.name || '', existing?.username || '');
    ctx.reply(
      `✅ <b>Manager qo'shildi</b>\n\n` +
      `👤 ID: <code>${targetId}</code>\n` +
      `🔧 Rol: Manager\n\n` +
      `Endi u /start buyrug'ini yuborsin.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// /removemanager 123456789
async function removeManager(ctx) {
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    return ctx.reply('📝 Foydalanish: /removemanager [telegram_id]');
  }
  const targetId = parseInt(parts[1]);
  if (isNaN(targetId)) return ctx.reply('❌ Noto\'g\'ri ID.');
  if (targetId === OWNER_ID) return ctx.reply('⛔ Owner ni o\'chirib bo\'lmaydi.');

  try {
    await removeBotUser(targetId);
    ctx.reply(`✅ ID <code>${targetId}</code> manager huquqi olib tashlandi.`, { parse_mode: 'HTML' });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// /listusers — barcha foydalanuvchilar
async function listUsers(ctx) {
  try {
    const users = await getBotUsers();
    if (!users.length) return ctx.reply('📭 Hozircha foydalanuvchilar yo\'q.');

    const roleEmoji = { owner: '👑', admin: '👨‍💼', manager: '👨‍🔧' };

    let text = '👥 <b>Bot foydalanuvchilari:</b>\n\n';
    users.forEach(u => {
      const emoji = roleEmoji[u.role] || '👤';
      const uname = u.username ? `@${u.username}` : '—';
      text += `${emoji} <b>${u.name || 'Nomsiz'}</b>\n`;
      text += `   ID: <code>${u.telegram_id}</code> | ${uname}\n`;
      text += `   Rol: ${u.role}\n\n`;
    });

    text += `\n📌 <b>Komandalar:</b>\n`;
    text += `/addadmin [id] — Admin qo'shish\n`;
    text += `/removeadmin [id] — Adminni o'chirish\n`;
    text += `/addmanager [id] — Manager qo'shish\n`;
    text += `/removemanager [id] — Managerni o'chirish`;

    ctx.reply(text, { parse_mode: 'HTML' });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

module.exports = {
  ownerHandler: { addAdmin, removeAdmin, addManager, removeManager, listUsers },
};
