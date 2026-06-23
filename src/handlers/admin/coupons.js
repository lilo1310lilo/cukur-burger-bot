const { Markup, Scenes } = require('telegraf');
const { getCoupons, getCoupon, addCoupon, updateCoupon, deleteCoupon } = require('../../db');
const { escapeHtml } = require('../../utils/escape');

function fmt(n) { return (Number(n) || 0).toLocaleString('uz-UZ'); }

function couponSummary(c) {
  const value = c.type === 'percent' ? `${c.amount}%` : `${fmt(c.amount)} UZS`;
  const status = c.is_active ? '🟢' : '🔴';
  const limit = c.usage_limit ? `${c.used_count}/${c.usage_limit}` : `${c.used_count}/∞`;
  const until = c.valid_until ? new Date(c.valid_until).toLocaleDateString('uz-UZ') : 'muddatsiz';
  return `${status} <b>${escapeHtml(c.code)}</b> — ${value}\n   Ishlatilgan: ${limit} | Amal qiladi: ${until}` +
    (c.min_order_amount ? `\n   Min buyurtma: ${fmt(c.min_order_amount)} UZS` : '');
}

// ─── KUPONLAR RO'YXATI ───────────────────────────────
async function showCoupons(ctx) {
  try {
    const coupons = await getCoupons();
    let text = '🎟 <b>Kuponlar / Chegirma kodlari</b>\n\n';
    const buttons = [];

    if (coupons.length) {
      coupons.forEach((c, i) => {
        text += `${i + 1}. ${couponSummary(c)}\n\n`;
        buttons.push([
          Markup.button.callback(`${c.is_active ? '🔴 O\'chir' : '🟢 Yoq'} ${c.code}`, `coupon_toggle_${c.id}`),
          Markup.button.callback(`🗑 ${c.code}`, `coupon_delete_${c.id}`),
        ]);
      });
    } else {
      text += 'Hozircha kuponlar yo\'q.\n';
    }

    buttons.push([Markup.button.callback('➕ Yangi kupon qo\'shish', 'coupon_add')]);
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── CALLBACK HANDLER ────────────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  if (data === 'coupon_add') {
    return ctx.scene.enter('ADD_COUPON');
  }

  // coupon_toggle_<uuid>
  if (data.startsWith('coupon_toggle_')) {
    const id = data.slice('coupon_toggle_'.length);
    const c = await getCoupon(id);
    if (!c) return ctx.reply('❌ Kupon topilmadi.');
    await updateCoupon(id, { is_active: !c.is_active });
    return showCoupons(ctx);
  }

  // coupon_delete_<uuid>
  if (data.startsWith('coupon_delete_') && !data.startsWith('coupon_delete_confirm_')) {
    const id = data.slice('coupon_delete_'.length);
    const c = await getCoupon(id);
    if (!c) return ctx.reply('❌ Kupon topilmadi.');
    return ctx.editMessageText(
      `🗑 <b>${escapeHtml(c.code)}</b> kuponini o'chirasizmi?`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Ha, o\'chirish', `coupon_delete_confirm_${id}`)],
        [Markup.button.callback('❌ Yo\'q', 'coupon_back')],
      ])}
    );
  }

  if (data.startsWith('coupon_delete_confirm_')) {
    const id = data.slice('coupon_delete_confirm_'.length);
    await deleteCoupon(id);
    await ctx.editMessageText('✅ Kupon o\'chirildi.');
    return showCoupons(ctx);
  }

  if (data === 'coupon_back') {
    return showCoupons(ctx);
  }
}

// ─── SCENE: YANGI KUPON QO'SHISH ─────────────────────
const addCouponScene = new Scenes.WizardScene(
  'ADD_COUPON',
  // 1: kod
  async (ctx) => {
    ctx.wizard.state.coupon = {};
    await ctx.reply('1️⃣ Kupon kodini kiriting (masalan: WELCOME10):\n(katta harfga o\'tkaziladi)');
    return ctx.wizard.next();
  },
  // 2: tur
  async (ctx) => {
    if (!ctx.message?.text) return;
    const code = ctx.message.text.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      await ctx.reply('❌ Kod 3-32 ta belgi: faqat harf, raqam, - va _ . Qaytadan kiriting:');
      return;
    }
    ctx.wizard.state.coupon.code = code;
    await ctx.reply('2️⃣ Chegirma turini tanlang:', Markup.inlineKeyboard([
      [Markup.button.callback('📊 Foiz (%)', 'ctype_percent')],
      [Markup.button.callback('💵 Qat\'iy summa (UZS)', 'ctype_fixed')],
    ]));
    return ctx.wizard.next();
  },
  // 3: miqdor
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('ctype_')) return;
    await ctx.answerCbQuery();
    ctx.wizard.state.coupon.type = ctx.callbackQuery.data === 'ctype_percent' ? 'percent' : 'fixed';
    const hint = ctx.wizard.state.coupon.type === 'percent'
      ? '3️⃣ Necha foiz chegirma? (1-100):'
      : '3️⃣ Qancha UZS chegirma? (masalan: 20000):';
    await ctx.reply(hint);
    return ctx.wizard.next();
  },
  // 4: min order
  async (ctx) => {
    if (!ctx.message?.text) return;
    const amount = parseInt(ctx.message.text.replace(/\D/g, ''));
    if (isNaN(amount) || amount <= 0) { await ctx.reply('❌ Faqat musbat raqam kiriting:'); return; }
    if (ctx.wizard.state.coupon.type === 'percent' && amount > 100) {
      await ctx.reply('❌ Foiz 1-100 oralig\'ida bo\'lishi kerak:'); return;
    }
    ctx.wizard.state.coupon.amount = amount;
    await ctx.reply('4️⃣ Minimal buyurtma summasi (UZS)?\n0 = cheklov yo\'q. (masalan: 100000 yoki 0):');
    return ctx.wizard.next();
  },
  // 5: usage limit
  async (ctx) => {
    if (!ctx.message?.text) return;
    const minOrder = parseInt(ctx.message.text.replace(/\D/g, ''));
    ctx.wizard.state.coupon.min_order_amount = isNaN(minOrder) ? 0 : minOrder;
    await ctx.reply('5️⃣ Ishlatish limiti (necha marta)?\n0 = cheksiz. (masalan: 100 yoki 0):');
    return ctx.wizard.next();
  },
  // 6: valid days
  async (ctx) => {
    if (!ctx.message?.text) return;
    const limit = parseInt(ctx.message.text.replace(/\D/g, ''));
    ctx.wizard.state.coupon.usage_limit = (!isNaN(limit) && limit > 0) ? limit : null;
    await ctx.reply('6️⃣ Necha kun amal qiladi?\n0 = muddatsiz. (masalan: 30 yoki 0):');
    return ctx.wizard.next();
  },
  // 7: save
  async (ctx) => {
    if (!ctx.message?.text) return;
    const days = parseInt(ctx.message.text.replace(/\D/g, ''));
    const coupon = ctx.wizard.state.coupon;
    coupon.is_active = true;
    coupon.valid_from = new Date().toISOString();
    if (!isNaN(days) && days > 0) {
      const until = new Date();
      until.setDate(until.getDate() + days);
      coupon.valid_until = until.toISOString();
    } else {
      coupon.valid_until = null;
    }

    try {
      const saved = await addCoupon(coupon);
      const value = saved.type === 'percent' ? `${saved.amount}%` : `${fmt(saved.amount)} UZS`;
      await ctx.reply(
        `✅ <b>Kupon yaratildi!</b>\n\n` +
        `🎟 Kod: <b>${escapeHtml(saved.code)}</b>\n` +
        `💸 Chegirma: ${value}\n` +
        (saved.min_order_amount ? `🧾 Min buyurtma: ${fmt(saved.min_order_amount)} UZS\n` : '') +
        (saved.usage_limit ? `🔢 Limit: ${saved.usage_limit} marta\n` : '🔢 Limit: cheksiz\n') +
        (saved.valid_until ? `📅 Amal qiladi: ${new Date(saved.valid_until).toLocaleDateString('uz-UZ')} gacha` : '📅 Muddatsiz'),
        { parse_mode: 'HTML', ...require('../start').getKeyboard(ctx.userRole || 'admin') }
      );
    } catch (err) {
      if (err.message && err.message.includes('duplicate')) {
        await ctx.reply('❌ Bu kod allaqachon mavjud. Boshqa kod bilan qaytadan urinib ko\'ring.');
      } else {
        await ctx.reply(`❌ Xatolik: ${err.message}`);
      }
    }
    return ctx.scene.leave();
  }
);

module.exports = {
  couponsHandler: { showCoupons, handleCallback },
  couponScenes: [addCouponScene],
};
