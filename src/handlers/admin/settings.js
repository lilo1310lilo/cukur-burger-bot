const { Markup, Scenes } = require('telegraf');
const { getSetting, setSetting, getAllSettings } = require('../../db');

// ─── SOZLAMALAR BOSH MENYU ────────────────────────────
async function showSettings(ctx) {
  const buttons = [
    [Markup.button.callback('💳 To\'lov kartasi', 'set_payment')],
    [Markup.button.callback('🚴 Yetkazib berish / buyurtma', 'set_delivery_fee')],
    [Markup.button.callback('📝 Sayt matnlari', 'set_texts')],
    [Markup.button.callback('📣 Promo banner', 'set_promo')],
    [Markup.button.callback('📍 Kafe ma\'lumotlari', 'set_cafe')],
    [Markup.button.callback('🔴 Cafe holati', 'set_cafe_status')],
  ];
  await ctx.reply('⚙️ <b>Sozlamalar</b>\n\nQaysi bo\'limni o\'zgartirmoqchisiz?',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
}

// ─── CALLBACK HANDLER ────────────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  // ── To'lov kartasi ──
  if (data === 'set_payment') {
    const cardNum = await getSetting('payment_card_number') || '—';
    const cardOwner = await getSetting('payment_card_owner') || '—';
    return ctx.editMessageText(
      `💳 <b>To'lov kartasi</b>\n\nHozirgi karta: <code>${cardNum}</code>\nEgasi: <b>${cardOwner}</b>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Karta raqamini o\'zgartirish', 'set_payment_number')],
        [Markup.button.callback('🔄 Egasi ismini o\'zgartirish', 'set_payment_owner')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_payment_number') {
    ctx.session.awaitingSetting = 'payment_card_number';
    return ctx.editMessageText('💳 Yangi karta raqamini kiriting:\nMisol: 8600 1234 5678 9012');
  }

  if (data === 'set_payment_owner') {
    ctx.session.awaitingSetting = 'payment_card_owner';
    return ctx.editMessageText('👤 Karta egasining ism-familiyasini kiriting:\nMisol: Sardor Karimov');
  }

  // ── Yetkazish narxi / chegaralar ──
  if (data === 'set_delivery_fee') {
    const fee = await getSetting('delivery_fee') || '15000';
    const threshold = await getSetting('free_delivery_threshold') || '150000';
    const minOrder = await getSetting('min_order_amount') || '0';
    return ctx.editMessageText(
      `🚴 <b>Yetkazib berish va buyurtma sozlamalari</b>\n\n` +
      `• Yetkazib berish narxi: <b>${parseInt(fee).toLocaleString()} UZS</b>\n` +
      `• Bepul yetkazish chegarasi: <b>${parseInt(threshold).toLocaleString()} UZS</b>\n` +
      `  <i>(shu summadan oshsa, yetkazish bepul)</i>\n` +
      `• Minimal buyurtma summasi: <b>${parseInt(minOrder).toLocaleString()} UZS</b>\n` +
      `  <i>(0 = cheklov yo'q)</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Yetkazish narxi', 'set_delivery_fee_edit')],
        [Markup.button.callback('🆓 Bepul yetkazish chegarasi', 'set_free_threshold_edit')],
        [Markup.button.callback('🧾 Minimal buyurtma summasi', 'set_min_order_edit')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_delivery_fee_edit') {
    ctx.session.awaitingSetting = 'delivery_fee';
    return ctx.editMessageText('💰 Yangi yetkazib berish narxini kiriting (UZS):\nMisol: 15000');
  }

  if (data === 'set_free_threshold_edit') {
    ctx.session.awaitingSetting = 'free_delivery_threshold';
    return ctx.editMessageText('🆓 Bepul yetkazish chegarasini kiriting (UZS):\nMisol: 150000\n(shu summadan oshsa yetkazish bepul)');
  }

  if (data === 'set_min_order_edit') {
    ctx.session.awaitingSetting = 'min_order_amount';
    return ctx.editMessageText('🧾 Minimal buyurtma summasini kiriting (UZS):\nMisol: 50000\n(0 = cheklov yo\'q)');
  }

  // ── Sayt matnlari ──
  if (data === 'set_texts') {
    return ctx.editMessageText(
      '📝 <b>Sayt matnlari</b>\n\nQaysi matnni o\'zgartirmoqchisiz?',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Bosh sahifa sarlavha', 'set_text_hero_title')],
        [Markup.button.callback('🏠 Bosh sahifa tavsif', 'set_text_hero_desc')],
        [Markup.button.callback('ℹ️ Biz haqimizda', 'set_text_about')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_text_hero_title') {
    const uz = await getSetting('hero_title_uz') || '';
    const en = await getSetting('hero_title_en') || '';
    const ru = await getSetting('hero_title_ru') || '';
    return ctx.editMessageText(
      `🏠 <b>Bosh sahifa sarlavha</b>\n\nUZ: ${uz}\nEN: ${en}\nRU: ${ru}`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 UZ', 'set_hero_title_uz'), Markup.button.callback('📝 EN', 'set_hero_title_en'), Markup.button.callback('📝 RU', 'set_hero_title_ru')],
        [Markup.button.callback('⬅️ Orqaga', 'set_texts')],
      ])}
    );
  }

  if (data === 'set_hero_title_uz') { ctx.session.awaitingSetting = 'hero_title_uz'; return ctx.editMessageText('📝 Bosh sahifa sarlavha (O\'zbekcha):'); }
  if (data === 'set_hero_title_en') { ctx.session.awaitingSetting = 'hero_title_en'; return ctx.editMessageText('📝 Hero title (English):'); }
  if (data === 'set_hero_title_ru') { ctx.session.awaitingSetting = 'hero_title_ru'; return ctx.editMessageText('📝 Заголовок (Русский):'); }

  if (data === 'set_text_hero_desc') {
    return ctx.editMessageText(
      '🏠 <b>Bosh sahifa tavsif</b>',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 UZ', 'set_hero_desc_uz'), Markup.button.callback('📝 EN', 'set_hero_desc_en'), Markup.button.callback('📝 RU', 'set_hero_desc_ru')],
        [Markup.button.callback('⬅️ Orqaga', 'set_texts')],
      ])}
    );
  }

  if (data === 'set_hero_desc_uz') { ctx.session.awaitingSetting = 'hero_desc_uz'; return ctx.editMessageText('📝 Bosh sahifa tavsifi (O\'zbekcha):'); }
  if (data === 'set_hero_desc_en') { ctx.session.awaitingSetting = 'hero_desc_en'; return ctx.editMessageText('📝 Hero description (English):'); }
  if (data === 'set_hero_desc_ru') { ctx.session.awaitingSetting = 'hero_desc_ru'; return ctx.editMessageText('📝 Описание (Русский):'); }

  if (data === 'set_text_about') {
    return ctx.editMessageText(
      'ℹ️ <b>Biz haqimizda</b>',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 UZ', 'set_about_uz'), Markup.button.callback('📝 EN', 'set_about_en'), Markup.button.callback('📝 RU', 'set_about_ru')],
        [Markup.button.callback('⬅️ Orqaga', 'set_texts')],
      ])}
    );
  }

  if (data === 'set_about_uz') { ctx.session.awaitingSetting = 'about_text_uz'; return ctx.editMessageText('📝 Biz haqimizda matni (O\'zbekcha):'); }
  if (data === 'set_about_en') { ctx.session.awaitingSetting = 'about_text_en'; return ctx.editMessageText('📝 About text (English):'); }
  if (data === 'set_about_ru') { ctx.session.awaitingSetting = 'about_text_ru'; return ctx.editMessageText('📝 О нас (Русский):'); }

  // ── Promo banner ──
  if (data === 'set_promo') {
    const active = await getSetting('promo_active') === 'true';
    const uz = await getSetting('promo_text_uz') || '';
    return ctx.editMessageText(
      `📣 <b>Promo banner</b>\n\nHolat: ${active ? '✅ Yoqilgan' : '❌ O\'chirilgan'}\n\nMatn (UZ): ${uz.substring(0, 50)}...`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback(active ? '🔴 O\'chirish' : '🟢 Yoqish', 'set_promo_toggle')],
        [Markup.button.callback('📝 Matn (UZ)', 'set_promo_uz'), Markup.button.callback('📝 Matn (EN)', 'set_promo_en'), Markup.button.callback('📝 Matn (RU)', 'set_promo_ru')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_promo_toggle') {
    const current = await getSetting('promo_active') === 'true';
    await setSetting('promo_active', (!current).toString());
    await ctx.answerCbQuery(`Promo ${!current ? 'yoqildi' : 'o\'chirildi'}`);
    return handleCallback({ ...ctx, callbackQuery: { ...ctx.callbackQuery, data: 'set_promo' } });
  }

  if (data === 'set_promo_uz') { ctx.session.awaitingSetting = 'promo_text_uz'; return ctx.editMessageText('📣 Promo matn (O\'zbekcha):'); }
  if (data === 'set_promo_en') { ctx.session.awaitingSetting = 'promo_text_en'; return ctx.editMessageText('📣 Promo text (English):'); }
  if (data === 'set_promo_ru') { ctx.session.awaitingSetting = 'promo_text_ru'; return ctx.editMessageText('📣 Промо текст (Русский):'); }

  // ── Kafe ma'lumotlari ──
  if (data === 'set_cafe') {
    const phone = await getSetting('cafe_phone') || '';
    const addrUz = await getSetting('cafe_address_uz') || '';
    return ctx.editMessageText(
      `📍 <b>Kafe ma'lumotlari</b>\n\nTelefon: ${phone}\nManzil (UZ): ${addrUz}`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('📞 Telefon', 'set_cafe_phone')],
        [Markup.button.callback('📍 Manzil (UZ)', 'set_cafe_addr_uz'), Markup.button.callback('📍 (EN)', 'set_cafe_addr_en'), Markup.button.callback('📍 (RU)', 'set_cafe_addr_ru')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_cafe_phone') { ctx.session.awaitingSetting = 'cafe_phone'; return ctx.editMessageText('📞 Yangi telefon raqam:\nMisol: +998 62 123 45 67'); }
  if (data === 'set_cafe_addr_uz') { ctx.session.awaitingSetting = 'cafe_address_uz'; return ctx.editMessageText('📍 Manzil (O\'zbekcha):'); }
  if (data === 'set_cafe_addr_en') { ctx.session.awaitingSetting = 'cafe_address_en'; return ctx.editMessageText('📍 Address (English):'); }
  if (data === 'set_cafe_addr_ru') { ctx.session.awaitingSetting = 'cafe_address_ru'; return ctx.editMessageText('📍 Адрес (Русский):'); }

  // ── Kafe holati ──
  if (data === 'set_cafe_status') {
    const isOpen = await getSetting('cafe_open') !== 'false';
    return ctx.editMessageText(
      `🔴🟢 <b>Kafe holati</b>\n\nHozir: ${isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback(isOpen ? '🔴 Yopish' : '🟢 Ochish', 'set_cafe_toggle')],
        [Markup.button.callback('⬅️ Orqaga', 'set_back')],
      ])}
    );
  }

  if (data === 'set_cafe_toggle') {
    const isOpen = await getSetting('cafe_open') !== 'false';
    await setSetting('cafe_open', (!isOpen).toString());
    const msg = !isOpen ? '🟢 Kafe ochildi!' : '🔴 Kafe yopildi!';
    await ctx.editMessageText(msg);
  }

  if (data === 'set_back') {
    ctx.session.awaitingSetting = null;
    return showSettings(ctx);
  }
}

// ─── MATN KIRITILGANDA ────────────────────────────────
async function handleTextInput(ctx) {
  if (!ctx.session?.awaitingSetting) return false;
  const key = ctx.session.awaitingSetting;
  const value = ctx.message.text;

  try {
    if (key === 'delivery_fee' || key === 'min_order_amount' || key === 'free_delivery_threshold') {
      const num = parseInt(value.replace(/\D/g, ''));
      if (isNaN(num)) { await ctx.reply('❌ Faqat raqam kiriting.'); return true; }
      await setSetting(key, num.toString());
    } else {
      await setSetting(key, value);
    }
    ctx.session.awaitingSetting = null;
    await ctx.reply(`✅ Saqlandi!`, { ...require('../start').getKeyboard(ctx.userRole || 'admin') });
    return true;
  } catch (err) {
    await ctx.reply(`❌ Xatolik: ${err.message}`);
    return true;
  }
}

module.exports = {
  settingsHandler: { showSettings, handleCallback, handleTextInput },
  settingsScenes: [],
};
