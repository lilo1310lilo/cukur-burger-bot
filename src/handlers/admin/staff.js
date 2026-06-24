const { Markup, Scenes } = require('telegraf');
const { getBotUsers, getBotUser, addBotUser, removeBotUser } = require('../../db');
const { OWNER_ID } = require('../../config');
const { escapeHtml } = require('../../utils/escape');

async function showStaff(ctx) {
  try {
    const users = await getBotUsers();
    let text = '👥 <b>Xodimlar (Admin va Managerlar)</b>\n\n';
    const buttons = [];

    const roleEmoji = { owner: '👑', admin: '👨‍💼', manager: '👨‍🔧' };

    users.forEach((u) => {
      text += `${roleEmoji[u.role] || '👤'} <b>${escapeHtml(u.name)}</b> (@${escapeHtml(u.username || 'yoq')})\n   ID: <code>${u.id}</code> | Rol: ${u.role}\n\n`;
      if (u.id !== OWNER_ID && u.id !== ctx.from.id) {
        buttons.push([Markup.button.callback(`❌ O'chirish: ${u.name}`, `staff_del_${u.id}`)]);
      }
    });

    buttons.push([Markup.button.callback('➕ Yangi Admin qo\'shish', 'staff_add_admin')]);
    buttons.push([Markup.button.callback('➕ Yangi Manager qo\'shish', 'staff_add_manager')]);

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (data === 'staff_add_admin') {
    ctx.session.staffRoleToAdd = 'admin';
    return ctx.scene.enter('ADD_STAFF');
  }
  if (data === 'staff_add_manager') {
    ctx.session.staffRoleToAdd = 'manager';
    return ctx.scene.enter('ADD_STAFF');
  }

  if (data.startsWith('staff_del_') && !data.startsWith('staff_del_confirm_')) {
    const id = parseInt(data.replace('staff_del_', ''));
    return ctx.editMessageText(
      `🗑 ID <code>${id}</code> xodimni ro'yxatdan o'chirasizmi?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, o\'chirish', `staff_del_confirm_${id}`)],
        [Markup.button.callback('❌ Yo\'q', 'staff_back')],
      ])}
    );
  }

  if (data.startsWith('staff_del_confirm_')) {
    const id = parseInt(data.replace('staff_del_confirm_', ''));
    await removeBotUser(id);
    await ctx.editMessageText('✅ Xodim o\'chirildi.');
    return showStaff(ctx);
  }

  if (data === 'staff_back') {
    return showStaff(ctx);
  }
}

// ─── SCENE: YANGI XODIM QO'SHISH ─────────────────────
const addStaffScene = new Scenes.WizardScene(
  'ADD_STAFF',
  async (ctx) => {
    await ctx.reply(`➕ Yangi ${ctx.session.staffRoleToAdd} qo'shish uchun uning Telegram ID raqamini kiriting:\n(Foydalanuvchi avval botga /start bosgan bo'lishi kerak yoki uning ID sini bilishingiz kerak)`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    const targetId = parseInt(ctx.message.text.trim());
    if (isNaN(targetId)) {
      await ctx.reply('❌ Noto\'g\'ri ID. Raqam kiriting:');
      return;
    }
    if (targetId === OWNER_ID) {
      await ctx.reply('⛔ Owner ni qo\'shib bo\'lmaydi.');
      return ctx.scene.leave();
    }
    const role = ctx.session.staffRoleToAdd;
    try {
      const existing = await getBotUser(targetId);
      await addBotUser(targetId, role, existing?.name || 'Yangi xodim', existing?.username || '');
      await ctx.reply(`✅ Xodim (${role}) muvaffaqiyatli qo'shildi! ID: ${targetId}`);
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

module.exports = { showStaff, handleCallback, staffScenes: [addStaffScene] };
