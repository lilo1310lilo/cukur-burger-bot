const { Markup, Scenes } = require('telegraf');
const {
  getCategories, getMenuItems, getMenuItem,
  addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItem,
  addCategory, deleteCategory,
} = require('../../db');
const { uploadTelegramPhotoToStorage } = require('../../utils/storage');
const { escapeHtml } = require('../../utils/escape');

// Mavjud dietik teglar (spicy avtomatik spicy_level dan kelib chiqadi — bu yerda yo'q)
const DIETARY_TAGS = [
  { key: 'vegetarian', label: '🌱 Vegetarian' },
  { key: 'halal', label: '🕋 Halol' },
  { key: 'nuts', label: '🥜 Yong\'oqli' },
];

// ─── MENYU RO'YXATINI KO'RSATISH ────────────────────
async function showMenu(ctx) {
  try {
    const items = await getMenuItems();
    if (!items.length) {
      return ctx.reply(
        '🍽 Menyu bo\'sh.\n\nYangi taom qo\'shish uchun "➕ Taom qo\'shish" tugmasini bosing.',
        Markup.keyboard([['➕ Taom qo\'shish', '🗂 Kategoriyalar'], ['⬅️ Orqaga']]).resize()
      );
    }
    const categories = await getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name_uz; });

    let text = '📋 <b>Menyu elementlari:</b>\n\n';
    const buttons = [];

    items.forEach((item, i) => {
      const status = item.is_available ? '✅' : '❌';
      const cat = catMap[item.category_id] || '—';
      text += `${i + 1}. ${status} <b>${escapeHtml(item.name_uz)}</b>\n`;
      text += `   💰 ${item.price.toLocaleString()} UZS | 📁 ${escapeHtml(cat)}\n\n`;

      buttons.push([
        Markup.button.callback(`✏️ ${item.name_uz.substring(0, 20)}`, `menu_edit_${item.id}`),
        Markup.button.callback(item.is_available ? '🔴 O\'chir' : '🟢 Yoq', `menu_toggle_${item.id}`),
        Markup.button.callback('🗑', `menu_delete_${item.id}`),
      ]);
    });

    buttons.push([Markup.button.callback('➕ Yangi taom qo\'shish', 'menu_add_new')]);

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── KATEGORIYALAR ────────────────────────────────────
async function showCategories(ctx) {
  try {
    const cats = await getCategories();
    let text = '🗂 <b>Kategoriyalar:</b>\n\n';
    const buttons = [];

    if (cats.length) {
      cats.forEach((c, i) => {
        text += `${i + 1}. ${escapeHtml(c.name_uz)} / ${escapeHtml(c.name_en)} / ${escapeHtml(c.name_ru)}\n`;
        buttons.push([Markup.button.callback(`🗑 ${c.name_uz}`, `cat_delete_${c.id}`)]);
      });
    } else {
      text += 'Kategoriyalar yo\'q.\n';
    }

    buttons.push([Markup.button.callback('➕ Kategoriya qo\'shish', 'cat_add')]);
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── CALLBACK HANDLER ────────────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  // Taomni tahrirlash
  if (data.startsWith('menu_edit_')) {
    const id = data.replace('menu_edit_', '');
    ctx.session.editItemId = id;
    const item = await getMenuItem(id);
    if (!item) return ctx.reply('❌ Taom topilmadi.');

    const buttons = [
      [Markup.button.callback('📝 Nomi (UZ)', `menu_field_name_uz_${id}`)],
      [Markup.button.callback('📝 Nomi (EN)', `menu_field_name_en_${id}`)],
      [Markup.button.callback('📝 Nomi (RU)', `menu_field_name_ru_${id}`)],
      [Markup.button.callback('📄 Tavsif (UZ)', `menu_field_desc_uz_${id}`)],
      [Markup.button.callback('📄 Tavsif (EN)', `menu_field_desc_en_${id}`)],
      [Markup.button.callback('📄 Tavsif (RU)', `menu_field_desc_ru_${id}`)],
      [Markup.button.callback('💰 Narxi', `menu_field_price_${id}`)],
      [Markup.button.callback('📸 Rasmi', `menu_field_image_${id}`)],
      [Markup.button.callback('🏷 Badge', `menu_field_badge_${id}`)],
      [Markup.button.callback('⚖️ Og\'irligi', `menu_field_weight_${id}`)],
      [Markup.button.callback('🌶 Achchiqlik darajasi', `menu_field_spicy_${id}`)],
      [Markup.button.callback('🥗 Dietik teglar', `menu_diet_${id}`)],
      [Markup.button.callback('🧩 Sozlamalar (optionlar)', `opt_groups_${id}`)],
      [Markup.button.callback('❌ Bekor qilish', 'menu_cancel')],
    ];

    return ctx.editMessageText(
      `✏️ <b>${item.name_uz}</b> ni tahrirlash\n\nQaysi maydonni o'zgartirmoqchisiz?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
    );
  }

  // Dietik teglar tahrirlash — toggle ko'rinishida
  if (data.startsWith('menu_diet_')) {
    const id = data.slice('menu_diet_'.length);
    const item = await getMenuItem(id);
    if (!item) return ctx.reply('❌ Taom topilmadi.');
    const current = Array.isArray(item.dietary_tags) ? item.dietary_tags : [];
    const buttons = DIETARY_TAGS.map(t => [
      Markup.button.callback(
        `${current.includes(t.key) ? '✅' : '⬜️'} ${t.label}`,
        `menu_diettag_${t.key}_${id}`
      ),
    ]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', `menu_edit_${id}`)]);
    return ctx.editMessageText(
      `🥗 <b>${escapeHtml(item.name_uz)}</b> — dietik teglar\n\nTeglarni yoqish/o'chirish uchun bosing:\n<i>(🌶 Achchiq filtri avtomatik achchiqlik darajasidan olinadi)</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
    );
  }

  // Dietik teg toggle: menu_diettag_<tag>_<uuid>
  if (data.startsWith('menu_diettag_')) {
    const rest = data.slice('menu_diettag_'.length);
    const sep = rest.indexOf('_');
    const tag = rest.slice(0, sep);
    const id = rest.slice(sep + 1);
    const item = await getMenuItem(id);
    if (!item) return ctx.reply('❌ Taom topilmadi.');
    const current = Array.isArray(item.dietary_tags) ? [...item.dietary_tags] : [];
    const idx = current.indexOf(tag);
    if (idx === -1) current.push(tag); else current.splice(idx, 1);
    await updateMenuItem(id, { dietary_tags: current });
    // Toggle ko'rinishini yangilash
    const buttons = DIETARY_TAGS.map(t => [
      Markup.button.callback(
        `${current.includes(t.key) ? '✅' : '⬜️'} ${t.label}`,
        `menu_diettag_${t.key}_${id}`
      ),
    ]);
    buttons.push([Markup.button.callback('⬅️ Orqaga', `menu_edit_${id}`)]);
    return ctx.editMessageReplyMarkup({ inline_keyboard: buttons });
  }

  // Maydon tahrirlash — UUID id va ko'p so'zli maydon nomlari (name_uz)
  // ni xavfsiz ajratamiz: maydon nomlari ma'lum to'plamdan, qolgani id.
  if (data.startsWith('menu_field_')) {
    const rest = data.slice('menu_field_'.length);
    const KNOWN_FIELDS = ['name_uz','name_en','name_ru','desc_uz','desc_en','desc_ru','price','image','badge','weight','spicy'];
    const field = KNOWN_FIELDS.find(f => rest.startsWith(f + '_'));
    if (!field) return;
    const id = rest.slice(field.length + 1);
    ctx.session.editField = field;
    ctx.session.editItemId = id;

    const fieldNames = {
      name_uz: 'nomi (O\'zbekcha)',
      name_en: 'nomi (Inglizcha)',
      name_ru: 'nomi (Ruscha)',
      desc_uz: 'tavsifi (O\'zbekcha)',
      desc_en: 'tavsifi (Inglizcha)',
      desc_ru: 'tavsifi (Ruscha)',
      price: 'narxi (faqat raqam)',
      badge: 'badge (Xit, Yangi, ...)',
      weight: 'og\'irligi (300 g)',
      spicy: 'achchiqlik darajasi (0, 1, 2, 3)',
    };

    if (field === 'image') {
      ctx.session.awaitingField = 'image';
      return ctx.reply('📸 Yangi rasmni yuboring (foto sifatida):');
    }

    ctx.session.awaitingField = field;
    return ctx.reply(`✏️ Taomning <b>${fieldNames[field] || field}</b> ni kiriting:`, { parse_mode: 'HTML' });
  }

  // Taomni yoqish/o'chirish
  if (data.startsWith('menu_toggle_')) {
    const id = data.replace('menu_toggle_', '');
    const item = await getMenuItem(id);
    if (!item) return ctx.reply('❌ Taom topilmadi.');
    await toggleMenuItem(id, !item.is_available);
    const status = !item.is_available ? '✅ Yoqildi' : '❌ O\'chirildi';
    await ctx.editMessageText(`${status}: <b>${item.name_uz}</b>`, { parse_mode: 'HTML' });
    return showMenu(ctx);
  }

  // Taomni o'chirish
  if (data.startsWith('menu_delete_')) {
    const id = data.replace('menu_delete_', '');
    const item = await getMenuItem(id);
    if (!item) return ctx.reply('❌ Topilmadi.');
    return ctx.editMessageText(
      `🗑 <b>${item.name_uz}</b> ni o'chirishni tasdiqlaysizmi?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, o\'chirish', `menu_confirm_delete_${id}`)],
        [Markup.button.callback('❌ Yo\'q', 'menu_cancel')],
      ])}
    );
  }

  if (data.startsWith('menu_confirm_delete_')) {
    const id = data.replace('menu_confirm_delete_', '');
    await deleteMenuItem(id);
    await ctx.editMessageText('✅ Taom menyudan o\'chirildi.');
    return showMenu(ctx);
  }

  // Yangi taom qo'shish
  if (data === 'menu_add_new') {
    return ctx.scene.enter('ADD_MENU_ITEM');
  }

  // Kategoriya qo'shish
  if (data === 'cat_add') {
    return ctx.scene.enter('ADD_CATEGORY');
  }

  // Kategoriya o'chirish
  if (data.startsWith('cat_delete_')) {
    const id = data.replace('cat_delete_', '');
    const cats = await getCategories();
    const cat = cats.find(c => c.id === id);
    if (!cat) return ctx.reply('❌ Topilmadi.');
    return ctx.editMessageText(
      `🗑 "<b>${cat.name_uz}</b>" kategoriyasini o'chirasizmi?\n⚠️ Bu kategoriyadan taomlar kategoriyasiz qoladi.`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ O\'chirish', `cat_confirm_delete_${id}`)],
        [Markup.button.callback('❌ Bekor', 'menu_cancel')],
      ])}
    );
  }

  if (data.startsWith('cat_confirm_delete_')) {
    const id = data.replace('cat_confirm_delete_', '');
    await deleteCategory(id);
    await ctx.editMessageText('✅ Kategoriya o\'chirildi.');
    return showCategories(ctx);
  }

  if (data === 'menu_cancel') {
    ctx.session.awaitingField = null;
    ctx.session.editItemId = null;
    await ctx.editMessageText('❌ Bekor qilindi.');
  }
}

// ─── MATN KIRITILGANDA (edit field) ─────────────────
async function handleTextInput(ctx) {
  if (!ctx.session?.awaitingField || !ctx.session?.editItemId) return false;

  const field = ctx.session.awaitingField;
  const id = ctx.session.editItemId;

  const dbFieldMap = {
    name_uz: 'name_uz', name_en: 'name_en', name_ru: 'name_ru',
    desc_uz: 'description_uz', desc_en: 'description_en', desc_ru: 'description_ru',
    badge: 'badge', weight: 'weight',
  };

  try {
    if (field === 'price') {
      const price = parseInt(ctx.message.text.replace(/\D/g, ''));
      if (isNaN(price) || price < 0) return ctx.reply('❌ Faqat raqam kiriting. Misol: 45000');
      await updateMenuItem(id, { price });
    } else if (field === 'spicy') {
      const level = parseInt(ctx.message.text);
      if (isNaN(level) || level < 0 || level > 3) return ctx.reply('❌ 0 dan 3 gacha raqam kiriting.');
      await updateMenuItem(id, { spicy_level: level });
    } else if (field === 'image') {
      // Rasm yuborilganda photo handler ishlaydi
      return false;
    } else if (dbFieldMap[field]) {
      await updateMenuItem(id, { [dbFieldMap[field]]: ctx.message.text });
    }

    ctx.session.awaitingField = null;
    ctx.session.editItemId = null;
    await ctx.reply('✅ Yangilandi!');
    return true;
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
    return true;
  }
}

// Rasm yuborilganda
async function handlePhotoInput(ctx) {
  if (ctx.session?.awaitingField !== 'image' || !ctx.session?.editItemId) return false;
  const id = ctx.session.editItemId;
  const photo = ctx.message.photo;
  if (!photo?.length) return false;

  const fileId = photo[photo.length - 1].file_id;
  try {
    // Telegram rasmini doimiy Supabase Storage URL ga aylantirish
    // (Telegram URL ~1 soatda eskiradi va BOT_TOKEN ni oshkor qiladi)
    const { url } = await uploadTelegramPhotoToStorage(ctx, fileId);
    await updateMenuItem(id, { image_url: url });
    ctx.session.awaitingField = null;
    ctx.session.editItemId = null;
    await ctx.reply('✅ Rasm yangilandi! (Supabase Storage ga doimiy saqlandi)');
    return true;
  } catch (err) {
    ctx.reply(`❌ Rasmni saqlashda xatolik: ${err.message}`);
    return true;
  }
}

// ─── SCENE: YANGI TAOM QO'SHISH ─────────────────────
const addMenuItemScene = new Scenes.WizardScene(
  'ADD_MENU_ITEM',
  // Qadam 1: Kategoriya tanlash
  async (ctx) => {
    ctx.wizard.state.item = {};
    const cats = await getCategories();
    if (!cats.length) {
      await ctx.reply('❌ Avval kategoriya qo\'shing!\n"🗂 Kategoriyalar" → "➕ Kategoriya qo\'shish"');
      return ctx.scene.leave();
    }
    const buttons = cats.map(c => [Markup.button.callback(c.name_uz, `addcat_${c.id}_${c.name_uz}`)]);
    buttons.push([Markup.button.callback('❌ Bekor qilish', 'additem_cancel')]);
    await ctx.reply('1️⃣ Kategoriyani tanlang:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  // Qadam 2: Kategoriya callback → nom UZ
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'additem_cancel') {
      await ctx.answerCbQuery();
      await ctx.reply('❌ Bekor qilindi.');
      return ctx.scene.leave();
    }
    if (!ctx.callbackQuery?.data?.startsWith('addcat_')) return;
    await ctx.answerCbQuery();
    const parts = ctx.callbackQuery.data.split('_');
    ctx.wizard.state.item.category_id = parts[1];
    ctx.wizard.state.item.cat_name = parts.slice(2).join('_');
    await ctx.reply(`2️⃣ Taom nomini kiriting (O'zbekcha):\nMisol: Çukur Classic Burger`);
    return ctx.wizard.next();
  },
  // Qadam 3: Nom EN
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.name_uz = ctx.message.text;
    await ctx.reply('3️⃣ Taom nomi (Inglizcha):');
    return ctx.wizard.next();
  },
  // Qadam 4: Nom RU
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.name_en = ctx.message.text;
    await ctx.reply('4️⃣ Taom nomi (Ruscha):');
    return ctx.wizard.next();
  },
  // Qadam 5: Tavsif UZ
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.name_ru = ctx.message.text;
    await ctx.reply('5️⃣ Tavsif (O\'zbekcha):\n(o\'tkazib yuborish uchun — yuborish)');
    return ctx.wizard.next();
  },
  // Qadam 6: Tavsif EN
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.description_uz = ctx.message.text;
    await ctx.reply('6️⃣ Tavsif (Inglizcha):');
    return ctx.wizard.next();
  },
  // Qadam 7: Tavsif RU
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.description_en = ctx.message.text;
    await ctx.reply('7️⃣ Tavsif (Ruscha):');
    return ctx.wizard.next();
  },
  // Qadam 8: Narx
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.description_ru = ctx.message.text;
    await ctx.reply('8️⃣ Narxini kiriting (faqat raqam, UZS):\nMisol: 45000');
    return ctx.wizard.next();
  },
  // Qadam 9: Og'irlik
  async (ctx) => {
    if (!ctx.message?.text) return;
    const price = parseInt(ctx.message.text.replace(/\D/g, ''));
    if (isNaN(price) || price < 0) {
      await ctx.reply('❌ Faqat raqam! Misol: 45000');
      return;
    }
    ctx.wizard.state.item.price = price;
    await ctx.reply('9️⃣ Og\'irligini kiriting:\nMisol: 300 g  (yo\'q bo\'lsa — yuboring)');
    return ctx.wizard.next();
  },
  // Qadam 10: Rasm
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.item.weight = ctx.message.text;
    await ctx.reply('🔟 Rasmini yuboring (foto sifatida):');
    return ctx.wizard.next();
  },
  // Qadam 11: Badge
  async (ctx) => {
    let imageUrl = '';
    if (ctx.message?.photo) {
      const photo = ctx.message.photo;
      const fileId = photo[photo.length - 1].file_id;
      try {
        // Doimiy Supabase Storage URL (Telegram URL eskiradi + tokenni oshkor qiladi)
        const { url } = await uploadTelegramPhotoToStorage(ctx, fileId);
        imageUrl = url;
      } catch (err) {
        await ctx.reply(`⚠️ Rasmni saqlashda muammo: ${err.message}\nRasmsiz davom etamiz.`);
      }
    }
    ctx.wizard.state.item.image_url = imageUrl;
    await ctx.reply(
      '1️⃣1️⃣ Badge (ixtiyoriy):\nMisol: Xit, Yangi, Mashhur, Achchiq\n(yo\'q bo\'lsa — yuboring)',
      Markup.keyboard([['—']]).resize()
    );
    return ctx.wizard.next();
  },
  // Qadam 12: Saqlash
  async (ctx) => {
    if (!ctx.message?.text) return;
    const badge = ctx.message.text === '—' ? '' : ctx.message.text;
    ctx.wizard.state.item.badge = badge;
    ctx.wizard.state.item.is_available = true;
    // Kategoriya nomini o'chirishdan OLDIN saqlab olamiz (xabarda ishlatamiz)
    const catName = ctx.wizard.state.item.cat_name || '—';
    delete ctx.wizard.state.item.cat_name; // Supabase'ga yubormaslik uchun

    try {
      const item = await addMenuItem(ctx.wizard.state.item);
      await ctx.reply(
        `✅ <b>Taom qo'shildi!</b>\n\n` +
        `🍔 ${escapeHtml(item.name_uz)}\n` +
        `💰 ${item.price.toLocaleString()} UZS\n` +
        `📁 Kategoriya: ${escapeHtml(catName)}`,
        { parse_mode: 'HTML', ...require('../start').getKeyboard(ctx.userRole || 'admin') }
      );
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

addMenuItemScene.action('additem_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('❌ Bekor qilindi.');
  return ctx.scene.leave();
});

// ─── SCENE: KATEGORIYA QO'SHISH ─────────────────────
const addCategoryScene = new Scenes.WizardScene(
  'ADD_CATEGORY',
  async (ctx) => {
    await ctx.reply('1️⃣ Kategoriya nomi (O\'zbekcha):\nMisol: Burgerlar');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.nameUz = ctx.message.text;
    await ctx.reply('2️⃣ Kategoriya nomi (Inglizcha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.nameEn = ctx.message.text;
    await ctx.reply('3️⃣ Kategoriya nomi (Ruscha):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    try {
      const cat = await addCategory(ctx.wizard.state.nameUz, ctx.wizard.state.nameEn, ctx.message.text);
      await ctx.reply(`✅ Kategoriya qo'shildi: <b>${cat.name_uz}</b>`, { parse_mode: 'HTML' });
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

function startAddItem(ctx) { return ctx.scene.enter('ADD_MENU_ITEM'); }

module.exports = {
  menuHandler: { showMenu, showCategories, startAddItem, handleCallback, handleTextInput, handlePhotoInput },
  menuScenes: [addMenuItemScene, addCategoryScene],
};
