const { Markup } = require('telegraf');
const { getOrders, getOrder, updateOrderStatus, getSetting } = require('../../db');
const { STATUS_LABELS } = require('../../config');
const { escapeHtml } = require('../../utils/escape');

// Rad etish sabablari (callback kalit → ko'rsatiladigan matn)
const REJECT_REASONS = {
  chek_soxta: 'Chek soxta',
  chek_aniq_emas: 'Chek o\'qib bo\'lmaydi',
  summa_mos_emas: 'Summa mos emas',
  kafe_yopiq: 'Kafe yopiq',
  boshqa: 'Boshqa sabab',
};

// ─── FAOL BUYURTMALAR RO'YXATI ────────────────────────
async function showActiveOrders(ctx) {
  try {
    const orders = await getOrders(null, 30);
    const active = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status));

    if (!active.length) {
      return ctx.reply(
        '📭 Hozircha faol buyurtmalar yo\'q.',
        Markup.keyboard([['📦 Buyurtmalar'], ['🕐 Ish vaqti']]).resize()
      );
    }

    let text = `📦 <b>Faol buyurtmalar (${active.length} ta):</b>\n\n`;
    const buttons = [];

    active.forEach(o => {
      const status = STATUS_LABELS[o.status] || o.status;
      const type = o.delivery_type === 'delivery' ? '🚴' : '🏃';
      text += `#${o.order_number} ${type} <b>${escapeHtml(o.customer_name)}</b> — ${o.total_price.toLocaleString()} UZS\n`;
      text += `   ${status}\n\n`;
      buttons.push([Markup.button.callback(
        `#${o.order_number} — ${o.customer_name}`,
        `order_view_${o.id}`
      )]);
    });

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

// ─── BUYURTMA KARTOCHKASI ─────────────────────────────
function buildOrderCard(o) {
  const type = o.delivery_type === 'delivery' ? '🚴 Yetkazib berish' : '🏃 Olib ketish';
  const status = STATUS_LABELS[o.status] || o.status;
  const date = new Date(o.created_at).toLocaleString('uz-UZ');

  let text = `🧾 <b>Buyurtma #${o.order_number}</b>\n`;
  text += `📅 ${date}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👤 <b>${escapeHtml(o.customer_name)}</b>\n`;
  text += `📞 <a href="tel:${escapeHtml(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a>\n`;
  text += `📦 ${type}\n`;

  if (o.delivery_type === 'delivery' && o.address) {
    text += `📍 ${escapeHtml(o.address)}\n`;
  }

  text += `\n🛒 <b>Buyurtma:</b>\n`;
  (o.items || []).forEach(it => {
    const name = it.name_uz || it.menuItem?.name_uz || it.name || '—';
    const price = it.price || it.menuItem?.price || 0;
    const comboMark = it.combo ? '🍱 ' : '';
    text += `• ${comboMark}${it.quantity || 1}x ${escapeHtml(name)} — ${(price * (it.quantity || 1)).toLocaleString()} UZS\n`;
    // Kombo tarkibi
    if (it.combo && Array.isArray(it.combo_items) && it.combo_items.length) {
      const inside = it.combo_items
        .map(ci => `${ci.quantity || 1}x ${ci.name_uz || ci.name_en || ci.name_ru || '—'}`)
        .join(', ');
      text += `   <i>↳ ${escapeHtml(inside)}</i>\n`;
    }
    // Tanlangan optionlar
    if (Array.isArray(it.options) && it.options.length) {
      it.options.forEach(op => {
        const grp = op.group_uz || op.group_en || op.group_ru || '';
        const ch = op.choice_uz || op.choice_en || op.choice_ru || '';
        const dp = op.price_delta ? ` (${op.price_delta > 0 ? '+' : ''}${Number(op.price_delta).toLocaleString()})` : '';
        text += `   <i>↳ ${escapeHtml(grp)}: ${escapeHtml(ch)}${dp}</i>\n`;
      });
    }
  });

  if (o.delivery_fee > 0) {
    text += `\n🚴 Yetkazish: ${o.delivery_fee.toLocaleString()} UZS\n`;
  }
  if (o.discount > 0) {
    text += `🎟 Chegirma${o.coupon_code ? ` (${escapeHtml(o.coupon_code)})` : ''}: −${o.discount.toLocaleString()} UZS\n`;
  }
  text += `💰 <b>Jami: ${o.total_price.toLocaleString()} UZS</b>\n`;

  if (o.notes) text += `\n📝 Izoh: ${escapeHtml(o.notes)}\n`;

  text += `\n📊 Status: ${status}`;
  return text;
}

// ─── STATUS TUGMALARI ─────────────────────────────────
function getStatusButtons(order) {
  const id = order.id;
  const s = order.status;
  const buttons = [];

  if (s === 'pending') {
    buttons.push([
      Markup.button.callback('✅ Tasdiqlash', `order_confirm_${id}`),
      Markup.button.callback('❌ Rad etish', `order_reject_${id}`),
    ]);
  }
  if (s === 'confirmed') {
    buttons.push([Markup.button.callback('👨‍🍳 Tayyorlanmoqda', `order_status_preparing_${id}`)]);
    buttons.push([Markup.button.callback('❌ Bekor qilish', `order_cancel_${id}`)]);
  }
  if (s === 'preparing') {
    if (order.delivery_type === 'delivery') {
      buttons.push([Markup.button.callback('🚴 Yo\'lga chiqdi', `order_status_shipping_${id}`)]);
    } else {
      buttons.push([Markup.button.callback('✅ Topshirildi', `order_status_delivered_${id}`)]);
    }
    buttons.push([Markup.button.callback('❌ Bekor qilish', `order_cancel_${id}`)]);
  }
  if (s === 'shipping') {
    buttons.push([Markup.button.callback('🎉 Yetkazildi', `order_status_delivered_${id}`)]);
  }
  if (['delivered', 'cancelled', 'rejected'].includes(s)) {
    buttons.push([Markup.button.callback('🔄 Qayta ko\'rish', `order_view_${id}`)]);
  }

  buttons.push([Markup.button.callback('⬅️ Orqaga', 'order_list')]);
  return Markup.inlineKeyboard(buttons);
}

// ─── CALLBACK HANDLER ────────────────────────────────
async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();

  // Buyurtmani ko'rish
  if (data.startsWith('order_view_')) {
    const id = data.replace('order_view_', '');
    const order = await getOrder(id);
    if (!order) return ctx.reply('❌ Buyurtma topilmadi.');

    await ctx.editMessageText(
      buildOrderCard(order),
      { parse_mode: 'HTML', ...getStatusButtons(order) }
    );
    return;
  }

  // Tasdiqlash
  if (data.startsWith('order_confirm_')) {
    const id = data.replace('order_confirm_', '');
    await updateOrderStatus(id, 'confirmed');
    const order = await getOrder(id);
    await ctx.editMessageText(
      `✅ Buyurtma #${order.order_number} tasdiqlandi!\n\n` + buildOrderCard(order),
      { parse_mode: 'HTML', ...getStatusButtons(order) }
    );
    // Saytga ham xabar beriladi (realtime orqali)
    return;
  }

  // Rad etish — sabab so'rash
  if (data.startsWith('order_reject_') && !data.startsWith('order_reject_reason_')) {
    const id = data.slice('order_reject_'.length);
    ctx.session.rejectOrderId = id;
    return ctx.editMessageText(
      '❌ <b>Rad etish sababi:</b>',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('💳 Chek soxta', `order_reject_reason_chek_soxta_${id}`)],
        [Markup.button.callback('🔍 Chek o\'qib bo\'lmaydi', `order_reject_reason_chek_aniq_emas_${id}`)],
        [Markup.button.callback('💰 Summa mos emas', `order_reject_reason_summa_mos_emas_${id}`)],
        [Markup.button.callback('⏰ Kafe yopiq', `order_reject_reason_kafe_yopiq_${id}`)],
        [Markup.button.callback('❌ Boshqa sabab', `order_reject_reason_boshqa_${id}`)],
        [Markup.button.callback('⬅️ Bekor', `order_view_${id}`)],
      ])}
    );
  }

  if (data.startsWith('order_reject_reason_')) {
    const rest = data.slice('order_reject_reason_'.length);
    // Ma'lum sabab kalitini boshidan aniqlaymiz, qolgani — UUID id.
    const reasonKey = Object.keys(REJECT_REASONS).find(k => rest.startsWith(k + '_'));
    if (!reasonKey) return;
    const id = rest.slice(reasonKey.length + 1);
    const reason = REJECT_REASONS[reasonKey];
    await updateOrderStatus(id, 'rejected', { cancel_reason: reason, cancelled_by: 'manager' });
    const order = await getOrder(id);
    await ctx.editMessageText(
      `❌ Buyurtma #${order.order_number} rad etildi.\nSabab: ${escapeHtml(reason)}\n\n` + buildOrderCard(order),
      { parse_mode: 'HTML', ...getStatusButtons(order) }
    );
    return;
  }

  // Bekor qilish (customer yoki manager)
  if (data.startsWith('order_cancel_')) {
    const id = data.replace('order_cancel_', '');
    await updateOrderStatus(id, 'cancelled', { cancelled_by: 'manager' });
    const order = await getOrder(id);
    await ctx.editMessageText(
      `🚫 Buyurtma #${order.order_number} bekor qilindi.\n\n` + buildOrderCard(order),
      { parse_mode: 'HTML', ...getStatusButtons(order) }
    );
    return;
  }

  // Status yangilash
  if (data.startsWith('order_status_')) {
    const withoutPrefix = data.replace('order_status_', '');
    const statusMap = { preparing: 'preparing', shipping: 'shipping', delivered: 'delivered' };
    let matched = null, id = null;

    for (const [key] of Object.entries(statusMap)) {
      if (withoutPrefix.startsWith(key + '_')) {
        matched = key;
        id = withoutPrefix.replace(key + '_', '');
        break;
      }
    }

    if (!matched || !id) return;

    await updateOrderStatus(id, matched);
    const order = await getOrder(id);
    const label = STATUS_LABELS[matched];
    await ctx.editMessageText(
      `${label} — Buyurtma #${order.order_number}\n\n` + buildOrderCard(order),
      { parse_mode: 'HTML', ...getStatusButtons(order) }
    );
    return;
  }

  // Ro'yxatga qaytish
  if (data === 'order_list') {
    return showActiveOrders(ctx);
  }
}

// ─── YANGI BUYURTMA XABARI ────────────────────────────
async function sendOrderNotification(bot, order, managerId) {
  const cardNum = await getSetting('payment_card_number') || '—';
  const cardOwner = await getSetting('payment_card_owner') || '—';

  const text =
    `🔔 <b>YANGI BUYURTMA #${order.order_number}</b>\n\n` +
    buildOrderCard(order) +
    `\n\n💳 Karta: <code>${escapeHtml(cardNum)}</code>\nEgasi: ${escapeHtml(cardOwner)}`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tasdiqlash', `order_confirm_${order.id}`),
      Markup.button.callback('❌ Rad etish', `order_reject_${order.id}`),
    ],
  ]);

  try {
    // Avval chek faylini yuborish (agar mavjud bo'lsa)
    if (order.receipt_telegram_file_id) {
      await bot.telegram.sendDocument(managerId, order.receipt_telegram_file_id, {
        caption: `📎 Buyurtma #${order.order_number} cheki`,
        parse_mode: 'HTML',
      });
    }
    // Keyin buyurtma ma'lumotlari
    await bot.telegram.sendMessage(managerId, text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
    return true;
  } catch (err) {
    console.error(`Manager ${managerId} ga xabar yuborishda xatolik:`, err.message);
    return false;
  }
}

module.exports = {
  ordersHandler: { showActiveOrders, handleCallback },
  sendOrderNotification,
  buildOrderCard,
};
