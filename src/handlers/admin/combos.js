const { Markup, Scenes } = require('telegraf');
const {
  getCombos, getCombo, addCombo, updateCombo, deleteCombo, toggleCombo,
  addComboItem, deleteComboItem, getMenuItems,
} = require('../../db');
const { uploadTelegramPhotoToStorage } = require('../../utils/storage');
const { escapeHtml } = require('../../utils/escape');

// ─── KOMBOLAR RO'YXATI ───────────────────────────────
async function showCombos(ctx) {
  try {
    const combos = await getCombos();
    if (!combos.length) {
      return ctx.reply(
        '🍱 Kombolar yo\'q.\n\nYangi kombo qo\'shish uchun quyidagini bosing.',
        Markup.inlineKeyboard([[Markup.button.callback('➕ Yangi kombo', 'combo_add_new')]])
      );
    }
    let text = '🍱 <b>Kombo / Set menyular:</b>\n\n';
    const buttons = [];
    combos.forEach((c, i) => {
      const status = c.is_available ? '✅' : '❌';
      const count = (c.combo_items || []).length;
      text += `${i + 1}. ${status} <b>${escapeHtml(c.name_uz)}</b>\n`;
      text += `   💰 ${c.price.toLocaleString()} UZS | 📦 ${count} ta taom\n\n`;
      buttons.push([
        Markup.button.callback(`✏️ ${c.name_uz.substring(0, 18)}`, `combo_edit_${c.id}`),
        Markup.button.callback(c.is_available ? '🔴' : '🟢', `combo_toggle_${c.id}`),
        Markup.button.callback('🗑', `combo_delete_${c.id}`),
      ]);
    });
    buttons.push([Markup.button.callback('➕ Yangi kombo', 'combo_add_new')]);
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── KOMBO TAHRIRLASH OYNASI ─────────────────────────
async function showComboEdit(ctx, id, asEdit = true) {
  const combo = await getCombo(id);
  if (!combo) return ctx.reply('❌ Kombo topilmadi.');
  let text = `🍱 <b>${escapeHtml(combo.name_uz)}</b>\n`;
  text += `💰 ${combo.price.toLocaleString()} UZS\n`;
  text += `📊 ${combo.is_available ? '✅ Faol' : '❌ Yashirin'}\n\n`;
  text += `<b>Tarkibi:</b>\n`;
  const items = combo.combo_items || [];
  if (items.length) {
    items.forEach(ci => {
      const nm = ci.menu_items?.name_uz || '—';
      text += `• ${ci.quantity}x ${escapeHtml(nm)}\n`;
    });
  } else {
    text += '<i>(hali taom qo\'shilmagan)</i>\n';
  }

  const buttons = [
    [Markup.button.callback('📦 Tarkibni boshqarish', `combo_items_${id}`)],
    [Markup.button.callback('📝 Nomi (UZ)', `combo_field_name_uz_${id}`), Markup.button.callback('💰 Narxi', `combo_field_price_${id}`)],
    [Markup.button.callback('📝 Nomi (EN)', `combo_field_name_en_${id}`), Markup.button.callback('📝 Nomi (RU)', `combo_field_name_ru_${id}`)],
    [Markup.button.callback('📄 Tavsif (UZ)', `combo_field_desc_uz_${id}`), Markup.button.callback('🏷 Badge', `combo_field_badge_${id}`)],
    [Markup.button.callback('📸 Rasmi', `combo_field_image_${id}`)],
    [Markup.button.callback(combo.is_available ? '🔴 Yashirish' : '🟢 Yoqish', `combo_toggle_${id}`)],
    [Markup.button.callback('🗑 O\'chirish', `combo_delete_${id}`)],
    [Markup.button.callback('⬅️ Orqaga', 'combo_list')],
  ];
  const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) };
  if (asEdit && ctx.callbackQuery) {
    try { return await ctx.editMessageText(text, opts); } catch { /* yangi xabar */ }
  }
  return ctx.reply(text, opts);
}

// ─── KOMBO TARKIBINI BOSHQARISH ──────────────────────
async function showComboItems(ctx, id) {
  const combo = await getCombo(id);
  if (!combo) return ctx.reply('❌ Kombo topilmadi.');
  let text = `📦 <b>${escapeHtml(combo.name_uz)}</b> — tarkibi\n\n`;
  const buttons = [];
  const items = combo.combo_items || [];
  if (items.length) {
    items.forEach(ci => {
      const nm = ci.menu_items?.name_uz || '—';
      text += `• ${ci.quantity}x ${escapeHtml(nm)}\n`;
      buttons.push([Markup.button.callback(`🗑 ${ci.quantity}x ${nm.substring(0, 18)}`, `combo_delitem_${ci.id}_${id}`)]);
    });
  } else {
    text += '<i>(bo\'sh)</i>\n';
  }
  buttons.push([Markup.button.callback('➕ Taom qo\'shish', `combo_additem_${id}`)]);
  buttons.push([Markup.button.callback('⬅️ Orqaga', `combo_edit_${id}`)]);
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  }
}

// ─── CALLBACK HANDLER (combo_*) ──────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (data === 'combo_add_new') {
    return ctx.scene.enter('ADD_COMBO');
  }

  if (data === 'combo_list') {
    return showCombos(ctx);
  }

  if (data.startsWith('combo_edit_')) {
    const id = data.slice('combo_edit_'.length);
    return showComboEdit(ctx, id);
  }

  if (data.startsWith('combo_items_')) {
    const id = data.slice('combo_items_'.length);
    return showComboItems(ctx, id);
  }

  // Tarkibga taom qo'shish — menyu ro'yxati
  if (data.startsWith('combo_additem_')) {
    const id = data.slice('combo_additem_'.length);
    const items = await getMenuItems();
    if (!items.length) return ctx.reply('❌ Avval menyuga taom qo\'shing.');
    const buttons = items.map(it => [Markup.button.callback(
      `${it.name_uz.substring(0, 28)} (${it.price.toLocaleString()})`,
      `combo_addmi_${id}_${it.id}`
    )]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', `combo_items_${id}`)]);
    return ctx.editMessageText('➕ Qaysi taomni qo\'shamiz?', Markup.inlineKeyboard(buttons));
  }

  // Tanlangan taom → miqdor so'rash (UUID lar tirelar bilan, _ yo'q)
  if (data.startsWith('combo_addmi_')) {
    const rest = data.slice('combo_addmi_'.length);
    const sep = rest.indexOf('_');
    const comboId = rest.slice(0, sep);
    const menuItemId = rest.slice(sep + 1);
    ctx.session.comboPendingItem = { comboId, menuItemId };
    return ctx.reply('🔢 Nechta dona? (raqam kiriting, masalan: 1)');
  }

  // Tarkibdan o'chirish: combo_delitem_<comboItemId>_<comboId>
  if (data.startsWith('combo_delitem_')) {
    const rest = data.slice('combo_delitem_'.length);
    const sep = rest.indexOf('_');
    const comboItemId = rest.slice(0, sep);
    const comboId = rest.slice(sep + 1);
    await deleteComboItem(comboItemId);
    return showComboItems(ctx, comboId);
  }

  if (data.startsWith('combo_toggle_')) {
    const id = data.slice('combo_toggle_'.length);
    const combo = await getCombo(id);
    if (!combo) return ctx.reply('❌ Topilmadi.');
    await toggleCombo(id, !combo.is_available);
    return showComboEdit(ctx, id);
  }

  if (data.startsWith('combo_delete_') && !data.startsWith('combo_delete_confirm_')) {
    const id = data.slice('combo_delete_'.length);
    const combo = await getCombo(id);
    if (!combo) return ctx.reply('❌ Topilmadi.');
    return ctx.editMessageText(
      `🗑 <b>${escapeHtml(combo.name_uz)}</b> kombosini o'chirasizmi?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, o\'chirish', `combo_delete_confirm_${id}`)],
        [Markup.button.callback('❌ Yo\'q', `combo_edit_${id}`)],
      ])}
    );
  }

  if (data.startsWith('combo_delete_confirm_')) {
    const id = data.slice('combo_delete_confirm_'.length);
    await deleteCombo(id);
    await ctx.editMessageText('✅ Kombo o\'chirildi.');
    return showCombos(ctx);
  }

  // Maydon tahrirlash
  if (data.startsWith('combo_field_')) {
    const rest = data.slice('combo_field_'.length);
    const KNOWN = ['name_uz', 'name_en', 'name_ru', 'desc_uz', 'desc_en', 'desc_ru', 'price', 'image', 'badge'];
    const field = KNOWN.find(f => rest.startsWith(f + '_'));
    if (!field) return;
    const id = rest.slice(field.length + 1);
    ctx.session.comboField = field;
    ctx.session.comboId = id;
    if (field === 'image') {
      return ctx.reply('📸 Yangi kombo rasmini yuboring (foto sifatida):');
    }
    const names = {
      name_uz: 'nomi (UZ)', name_en: 'nomi (EN)', name_ru: 'nomi (RU)',
      desc_uz: 'tavsifi (UZ)', desc_en: 'tavsifi (EN)', desc_ru: 'tavsifi (RU)',
      price: 'narxi (faqat raqam)', badge: 'badge (masalan: Tejamkor)',
    };
    return ctx.reply(`✏️ Kombo ${names[field] || field} ni kiriting:`);
  }
}

// ─── MATN KIRITISH (combo maydonlari + tarkib miqdori) ──
async function handleTextInput(ctx) {
  // Tarkibga taom qo'shish — miqdor
  if (ctx.session?.comboPendingItem) {
    const { comboId, menuItemId } = ctx.session.comboPendingItem;
    const qty = parseInt(ctx.message.text.replace(/\D/g, ''));
    if (isNaN(qty) || qty < 1) { await ctx.reply('❌ Kamida 1 ta raqam kiriting.'); return true; }
    try {
      await addComboItem(comboId, menuItemId, qty);
      ctx.session.comboPendingItem = null;
      await ctx.reply('✅ Tarkibga qo\'shildi!');
      await showComboItems(ctx, comboId);
    } catch (err) {
      ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return true;
  }

  // Maydon tahrirlash
  if (ctx.session?.comboField && ctx.session?.comboId) {
    const field = ctx.session.comboField;
    const id = ctx.session.comboId;
    if (field === 'image') return false; // photo handler ishlaydi
    const dbMap = {
      name_uz: 'name_uz', name_en: 'name_en', name_ru: 'name_ru',
      desc_uz: 'description_uz', desc_en: 'description_en', desc_ru: 'description_ru',
      badge: 'badge',
    };
    try {
      if (field === 'price') {
        const price = parseInt(ctx.message.text.replace(/\D/g, ''));
        if (isNaN(price) || price < 0) { await ctx.reply('❌ Faqat raqam. Misol: 99000'); return true; }
        await updateCombo(id, { price });
      } else if (dbMap[field]) {
        await updateCombo(id, { [dbMap[field]]: ctx.message.text });
      }
      ctx.session.comboField = null;
      ctx.session.comboId = null;
      await ctx.reply('✅ Yangilandi!');
      await showComboEdit(ctx, id, false);
    } catch (err) {
      ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return true;
  }
  return false;
}

// ─── RASM KIRITISH (combo) ───────────────────────────
async function handlePhotoInput(ctx) {
  if (ctx.session?.comboField !== 'image' || !ctx.session?.comboId) return false;
  const id = ctx.session.comboId;
  const photo = ctx.message.photo;
  if (!photo?.length) return false;
  const fileId = photo[photo.length - 1].file_id;
  try {
    const { url } = await uploadTelegramPhotoToStorage(ctx, fileId);
    await updateCombo(id, { image_url: url });
    ctx.session.comboField = null;
    ctx.session.comboId = null;
    await ctx.reply('✅ Rasm yangilandi! (Supabase Storage ga saqlandi)');
    await showComboEdit(ctx, id, false);
    return true;
  } catch (err) {
    ctx.reply(`❌ Rasmni saqlashda xatolik: ${err.message}`);
    return true;
  }
}

// ─── SCENE: YANGI KOMBO QO'SHISH ─────────────────────
const addComboScene = new Scenes.WizardScene(
  'ADD_COMBO',
  async (ctx) => {
    ctx.wizard.state.combo = {};
    await ctx.reply('1️⃣ Kombo nomi (O\'zbekcha):\nMisol: Oilaviy Set');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.name_uz = ctx.message.text;
    await ctx.reply('2️⃣ Kombo nomi (Inglizcha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.name_en = ctx.message.text;
    await ctx.reply('3️⃣ Kombo nomi (Ruscha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.name_ru = ctx.message.text;
    await ctx.reply('4️⃣ Tavsif (O\'zbekcha):\n(yo\'q bo\'lsa — yuboring)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.description_uz = ctx.message.text === '—' ? '' : ctx.message.text;
    await ctx.reply('5️⃣ Tavsif (Inglizcha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.description_en = ctx.message.text === '—' ? '' : ctx.message.text;
    await ctx.reply('6️⃣ Tavsif (Ruscha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.description_ru = ctx.message.text === '—' ? '' : ctx.message.text;
    await ctx.reply('7️⃣ Kombo narxi (faqat raqam, UZS):\nMisol: 99000');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    const price = parseInt(ctx.message.text.replace(/\D/g, ''));
    if (isNaN(price) || price < 0) { await ctx.reply('❌ Faqat raqam! Misol: 99000'); return; }
    ctx.wizard.state.combo.price = price;
    await ctx.reply('8️⃣ Kombo rasmini yuboring (foto sifatida, yo\'q bo\'lsa — "—" yuboring):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    let imageUrl = '';
    if (ctx.message?.photo) {
      const photo = ctx.message.photo;
      const fileId = photo[photo.length - 1].file_id;
      try {
        const { url } = await uploadTelegramPhotoToStorage(ctx, fileId);
        imageUrl = url;
      } catch (err) {
        await ctx.reply(`⚠️ Rasmni saqlashda muammo: ${err.message}\nRasmsiz davom etamiz.`);
      }
    } else if (!ctx.message?.text) {
      return;
    }
    ctx.wizard.state.combo.image_url = imageUrl;
    await ctx.reply('9️⃣ Badge (ixtiyoriy, masalan: Tejamkor):\n(yo\'q bo\'lsa — "—" yuboring)');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.combo.badge = ctx.message.text === '—' ? '' : ctx.message.text;
    ctx.wizard.state.combo.is_available = true;
    try {
      const combo = await addCombo(ctx.wizard.state.combo);
      await ctx.reply(
        `✅ <b>Kombo qo'shildi!</b>\n\n🍱 ${escapeHtml(combo.name_uz)}\n💰 ${combo.price.toLocaleString()} UZS\n\n` +
        `Endi tarkibiga taomlarni qo'shing:`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
          [Markup.button.callback('📦 Tarkibni boshqarish', `combo_items_${combo.id}`)],
          [Markup.button.callback('⬅️ Kombolar ro\'yxati', 'combo_list')],
        ])}
      );
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

module.exports = {
  combosHandler: { showCombos, handleCallback, handleTextInput, handlePhotoInput },
  comboScenes: [addComboScene],
};
