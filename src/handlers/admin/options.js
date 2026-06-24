const { Markup, Scenes } = require('telegraf');
const {
  getMenuItem, getItemOptions, getOption,
  addOption, deleteOption, addOptionChoice, deleteOptionChoice,
} = require('../../db');
const { escapeHtml } = require('../../utils/escape');

// ─── ITEM UCHUN OPTION GURUHLARI ─────────────────────
async function showItemOptions(ctx, itemId) {
  const item = await getMenuItem(itemId);
  if (!item) return ctx.reply('❌ Taom topilmadi.');
  const groups = await getItemOptions(itemId);

  let text = `🧩 <b>${escapeHtml(item.name_uz)}</b> — sozlamalari (modifikatorlar)\n\n`;
  const buttons = [];
  if (groups.length) {
    groups.forEach(g => {
      const type = g.type === 'multi' ? 'ko\'p tanlov' : 'bitta tanlov';
      const req = g.required ? ' • majburiy' : '';
      const cc = (g.choices || []).length;
      text += `• <b>${escapeHtml(g.name_uz)}</b> (${type}${req}) — ${cc} variant\n`;
      buttons.push([
        Markup.button.callback(`⚙️ ${g.name_uz.substring(0, 20)}`, `opt_group_${g.id}_${itemId}`),
        Markup.button.callback('🗑', `opt_delgrp_${g.id}_${itemId}`),
      ]);
    });
  } else {
    text += '<i>(sozlama guruhlari yo\'q)</i>\n';
  }
  text += '\n<i>Masalan: "Hajmi" (bitta tanlov, majburiy), "Qo\'shimchalar" (ko\'p tanlov)</i>';
  buttons.push([Markup.button.callback('➕ Guruh qo\'shish', `opt_addgrp_${itemId}`)]);
  buttons.push([Markup.button.callback('⬅️ Orqaga', `menu_edit_${itemId}`)]);

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  }
}

// ─── GURUH ICHIDAGI VARIANTLAR ───────────────────────
async function showGroupChoices(ctx, groupId, itemId) {
  const group = await getOption(groupId);
  if (!group) return ctx.reply('❌ Guruh topilmadi.');
  let text = `⚙️ <b>${escapeHtml(group.name_uz)}</b>\n`;
  text += `Turi: ${group.type === 'multi' ? 'ko\'p tanlov' : 'bitta tanlov'}${group.required ? ' • majburiy' : ''}\n\n`;
  text += `<b>Variantlar:</b>\n`;
  const buttons = [];
  const choices = (group.choices || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (choices.length) {
    choices.forEach(ch => {
      const dp = ch.price_delta ? ` (${ch.price_delta > 0 ? '+' : ''}${ch.price_delta.toLocaleString()})` : '';
      text += `• ${escapeHtml(ch.name_uz)}${dp}\n`;
      buttons.push([Markup.button.callback(`🗑 ${ch.name_uz.substring(0, 22)}${dp}`, `opt_delchoice_${ch.id}_${groupId}`)]);
    });
  } else {
    text += '<i>(variant yo\'q)</i>\n';
  }
  buttons.push([Markup.button.callback('➕ Variant qo\'shish', `opt_addchoice_${groupId}_${itemId}`)]);
  buttons.push([Markup.button.callback('⬅️ Orqaga', `opt_groups_${itemId}`)]);
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  }
}

// ─── CALLBACK HANDLER (opt_*) ────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (data.startsWith('opt_groups_')) {
    const itemId = data.slice('opt_groups_'.length);
    return showItemOptions(ctx, itemId);
  }

  if (data.startsWith('opt_addgrp_')) {
    const itemId = data.slice('opt_addgrp_'.length);
    return ctx.scene.enter('ADD_OPTION_GROUP', { itemId });
  }

  if (data.startsWith('opt_group_')) {
    const rest = data.slice('opt_group_'.length);
    const sep = rest.indexOf('_');
    const groupId = rest.slice(0, sep);
    const itemId = rest.slice(sep + 1);
    return showGroupChoices(ctx, groupId, itemId);
  }

  if (data.startsWith('opt_delgrp_')) {
    const rest = data.slice('opt_delgrp_'.length);
    const sep = rest.indexOf('_');
    const groupId = rest.slice(0, sep);
    const itemId = rest.slice(sep + 1);
    await deleteOption(groupId);
    return showItemOptions(ctx, itemId);
  }

  if (data.startsWith('opt_addchoice_')) {
    const rest = data.slice('opt_addchoice_'.length);
    const sep = rest.indexOf('_');
    const groupId = rest.slice(0, sep);
    const itemId = rest.slice(sep + 1);
    return ctx.scene.enter('ADD_OPTION_CHOICE', { groupId, itemId });
  }

  if (data.startsWith('opt_delchoice_')) {
    const rest = data.slice('opt_delchoice_'.length);
    const sep = rest.indexOf('_');
    const choiceId = rest.slice(0, sep);
    const groupId = rest.slice(sep + 1);
    const group = await getOption(groupId);
    await deleteOptionChoice(choiceId);
    return showGroupChoices(ctx, groupId, group ? group.menu_item_id : '');
  }
}

// ─── SCENE: OPTION GURUHI QO'SHISH ───────────────────
const addOptionGroupScene = new Scenes.WizardScene(
  'ADD_OPTION_GROUP',
  async (ctx) => {
    ctx.wizard.state.group = { menu_item_id: ctx.scene.state.itemId };
    await ctx.reply('1️⃣ Guruh nomi (UZ):\nMisol: Hajmi / Qo\'shimchalar');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.group.name_uz = ctx.message.text;
    await ctx.reply('2️⃣ Guruh nomi (EN):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.group.name_en = ctx.message.text;
    await ctx.reply('3️⃣ Guruh nomi (RU):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.group.name_ru = ctx.message.text;
    await ctx.reply('4️⃣ Tanlov turi?', Markup.inlineKeyboard([
      [Markup.button.callback('🔘 Bitta tanlov (single)', 'optg_type_single')],
      [Markup.button.callback('☑️ Ko\'p tanlov (multi)', 'optg_type_multi')],
    ]));
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('optg_type_')) return;
    await ctx.answerCbQuery();
    ctx.wizard.state.group.type = ctx.callbackQuery.data.replace('optg_type_', '');
    await ctx.reply('5️⃣ Majburiymi?', Markup.inlineKeyboard([
      [Markup.button.callback('✅ Ha (majburiy)', 'optg_req_yes')],
      [Markup.button.callback('⬜️ Yo\'q (ixtiyoriy)', 'optg_req_no')],
    ]));
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('optg_req_')) return;
    await ctx.answerCbQuery();
    ctx.wizard.state.group.required = ctx.callbackQuery.data === 'optg_req_yes';
    const itemId = ctx.wizard.state.group.menu_item_id;
    try {
      const g = await addOption(ctx.wizard.state.group);
      await ctx.reply(
        `✅ Guruh qo'shildi: <b>${escapeHtml(g.name_uz)}</b>\nEndi variantlarni qo'shing:`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Variant qo\'shish', `opt_addchoice_${g.id}_${itemId}`)],
          [Markup.button.callback('⬅️ Sozlamalar', `opt_groups_${itemId}`)],
        ])}
      );
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

// ─── SCENE: VARIANT QO'SHISH ─────────────────────────
const addOptionChoiceScene = new Scenes.WizardScene(
  'ADD_OPTION_CHOICE',
  async (ctx) => {
    ctx.wizard.state.choice = { option_id: ctx.scene.state.groupId };
    ctx.wizard.state.itemId = ctx.scene.state.itemId;
    await ctx.reply('1️⃣ Variant nomi (UZ):\nMisol: Katta / Qo\'shimcha pishloq');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.choice.name_uz = ctx.message.text;
    await ctx.reply('2️⃣ Variant nomi (EN):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.choice.name_en = ctx.message.text;
    await ctx.reply('3️⃣ Variant nomi (RU):');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    ctx.wizard.state.choice.name_ru = ctx.message.text;
    await ctx.reply('4️⃣ Narxga qo\'shimcha (UZS, 0 ham bo\'ladi, manfiy ham):\nMisol: 10000 yoki 0 yoki -5000');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) return;
    const raw = ctx.message.text.trim();
    const delta = parseInt(raw.replace(/[^0-9-]/g, ''), 10);
    if (isNaN(delta)) { await ctx.reply('❌ Faqat raqam. Misol: 10000 yoki 0'); return; }
    ctx.wizard.state.choice.price_delta = delta;
    const itemId = ctx.wizard.state.itemId;
    const groupId = ctx.wizard.state.choice.option_id;
    try {
      const ch = await addOptionChoice(ctx.wizard.state.choice);
      await ctx.reply(
        `✅ Variant qo'shildi: <b>${escapeHtml(ch.name_uz)}</b>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Yana variant', `opt_addchoice_${groupId}_${itemId}`)],
          [Markup.button.callback('⬅️ Variantlar', `opt_group_${groupId}_${itemId}`)],
        ])}
      );
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err.message}`);
    }
    return ctx.scene.leave();
  }
);

module.exports = {
  optionsHandler: { showItemOptions, handleCallback },
  optionScenes: [addOptionGroupScene, addOptionChoiceScene],
};
