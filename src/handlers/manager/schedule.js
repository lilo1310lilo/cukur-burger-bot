const { Markup, Scenes } = require('telegraf');
const { getSchedule, updateScheduleDay, getSetting, setSetting } = require('../../db');

const DAY_NAMES = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

// ─── ISH JADVALINI KO'RSATISH ─────────────────────────
async function showSchedule(ctx) {
  try {
    const schedule = await getSchedule();
    const cafeOpen = await getSetting('cafe_open') !== 'false';

    let text = `🕐 <b>Kafe ish jadvali</b>\n\n`;
    text += `Hozirgi holat: ${cafeOpen ? '🟢 Ochiq' : '🔴 Yopiq'}\n\n`;

    schedule.forEach(day => {
      const status = day.is_holiday ? '🏖 Dam olish' : day.is_open ? `✅ ${day.open_time}–${day.close_time}` : '❌ Yopiq';
      text += `${DAY_NAMES[day.day]}: ${status}\n`;
    });

    const today = new Date().getDay() || 7;
    const todaySchedule = schedule.find(d => d.day === today);

    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(cafeOpen ? '🔴 Hozir yopish' : '🟢 Hozir ochish', 'sched_toggle_now')],
        [Markup.button.callback(`✏️ Bugunni sozlash (${DAY_NAMES[today]})`, `sched_edit_${today}`)],
        [Markup.button.callback('📅 Haftalik jadval', 'sched_week')],
      ])
    });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── CALLBACK HANDLER ─────────────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  // Hozir ochish/yopish
  if (data === 'sched_toggle_now') {
    const isOpen = await getSetting('cafe_open') !== 'false';
    await setSetting('cafe_open', (!isOpen).toString());
    const msg = !isOpen ? '🟢 Kafe ochildi!' : '🔴 Kafe yopildi!';
    return ctx.editMessageText(msg + '\n\nJadvalga qaytish uchun "🕐 Ish vaqti" tugmasini bosing.');
  }

  // Haftalik jadval
  if (data === 'sched_week') {
    const schedule = await getSchedule();
    const buttons = schedule.map(day => [
      Markup.button.callback(
        `${DAY_NAMES[day.day]}: ${day.is_holiday ? '🏖' : day.is_open ? '✅' : '❌'}`,
        `sched_edit_${day.day}`
      )
    ]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', 'sched_back')]);
    return ctx.editMessageText(
      '📅 <b>Kunni tanlang:</b>',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
    );
  }

  // Kun sozlash
  if (data.startsWith('sched_edit_')) {
    const day = parseInt(data.replace('sched_edit_', ''));
    const schedule = await getSchedule();
    const d = schedule.find(s => s.day === day);
    if (!d) return;

    const status = d.is_holiday ? '🏖 Dam olish' : d.is_open ? `✅ ${d.open_time}–${d.close_time}` : '❌ Yopiq';

    return ctx.editMessageText(
      `✏️ <b>${DAY_NAMES[day]}</b>\n\nHozirgi holat: ${status}`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ochiq qilish', `sched_open_${day}`)],
        [Markup.button.callback('❌ Yopiq qilish', `sched_close_${day}`)],
        [Markup.button.callback('🏖 Dam olish kuni', `sched_holiday_${day}`)],
        [Markup.button.callback('⏰ Vaqtini o\'zgartirish', `sched_time_${day}`)],
        [Markup.button.callback('⬅️ Orqaga', 'sched_week')],
      ])}
    );
  }

  if (data.startsWith('sched_open_')) {
    const day = parseInt(data.replace('sched_open_', ''));
    await updateScheduleDay(day, { is_open: true, is_holiday: false });
    await ctx.editMessageText(`✅ ${DAY_NAMES[day]} ish kuni qilindi.`);
  }

  if (data.startsWith('sched_close_')) {
    const day = parseInt(data.replace('sched_close_', ''));
    await updateScheduleDay(day, { is_open: false, is_holiday: false });
    await ctx.editMessageText(`❌ ${DAY_NAMES[day]} yopiq qilindi.`);
  }

  if (data.startsWith('sched_holiday_')) {
    const day = parseInt(data.replace('sched_holiday_', ''));
    await updateScheduleDay(day, { is_holiday: true, is_open: false });
    await ctx.editMessageText(`🏖 ${DAY_NAMES[day]} dam olish kuni qilindi.`);
  }

  if (data.startsWith('sched_time_')) {
    const day = parseInt(data.replace('sched_time_', ''));
    ctx.session.schedDay = day;
    ctx.session.awaitingSchedule = 'open_time';
    return ctx.editMessageText(
      `⏰ <b>${DAY_NAMES[day]}</b> uchun ochilish vaqtini kiriting:\nFormat: HH:MM (masalan: 10:00)`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'sched_back') {
    return showSchedule(ctx);
  }
}

// ─── VAQT KIRITILGANDA ────────────────────────────────
async function handleTextInput(ctx) {
  if (!ctx.session?.awaitingSchedule || !ctx.session?.schedDay) return false;
  const text = ctx.message.text.trim();

  if (!/^\d{1,2}:\d{2}$/.test(text)) {
    await ctx.reply('❌ Noto\'g\'ri format. Misol: 10:00 yoki 05:00');
    return true;
  }

  if (ctx.session.awaitingSchedule === 'open_time') {
    ctx.session.openTime = text;
    ctx.session.awaitingSchedule = 'close_time';
    await ctx.reply(`✅ Ochilish: ${text}\n\nEndi yopilish vaqtini kiriting (masalan: 05:00):`);
    return true;
  }

  if (ctx.session.awaitingSchedule === 'close_time') {
    const day = ctx.session.schedDay;
    await updateScheduleDay(day, {
      open_time: ctx.session.openTime,
      close_time: text,
      is_open: true,
      is_holiday: false,
    });
    ctx.session.awaitingSchedule = null;
    ctx.session.schedDay = null;
    ctx.session.openTime = null;
    await ctx.reply(`✅ ${DAY_NAMES[day]} vaqti yangilandi: ${ctx.session?.openTime || '?'}–${text}`);
    return true;
  }

  return false;
}

module.exports = {
  scheduleHandler: { showSchedule, handleCallback, handleTextInput },
  scheduleScenes: [],
};
