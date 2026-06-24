const { Markup } = require('telegraf');
const { getStats, getOrders } = require('../../db');

function fmt(n) { return (n || 0).toLocaleString('uz-UZ'); }

function calcStats(orders) {
  const confirmed = orders.filter(o => ['confirmed','preparing','shipping','delivered'].includes(o.status));
  const delivered = orders.filter(o => o.status === 'delivered');
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const rejected  = orders.filter(o => o.status === 'rejected');
  const pending   = orders.filter(o => o.status === 'pending');

  const revenue = delivered.reduce((s, o) => s + (o.total_price || 0), 0);
  const avgOrder = delivered.length ? Math.round(revenue / delivered.length) : 0;

  // Soatlar tahlili
  const hourMap = Array(24).fill(0);
  orders.forEach(o => {
    const h = new Date(o.created_at).getHours();
    hourMap[h]++;
  });
  const peakHour = hourMap.indexOf(Math.max(...hourMap));

  // Hafta kunlari
  const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];
  const dayMap = Array(7).fill(0);
  orders.forEach(o => { dayMap[new Date(o.created_at).getDay()]++; });
  const peakDay = days[dayMap.indexOf(Math.max(...dayMap))];

  // Yetkazish vs Olib ketish
  const deliveryCount = orders.filter(o => o.delivery_type === 'delivery').length;
  const pickupCount   = orders.filter(o => o.delivery_type === 'pickup').length;

  // Top taomlar
  const itemMap = {};
  delivered.forEach(o => {
    (o.items || []).forEach(it => {
      const name = it.name_uz || it.menuItem?.name_uz || it.name || 'Noma\'lum';
      if (!itemMap[name]) itemMap[name] = { count: 0, revenue: 0 };
      itemMap[name].count   += it.quantity || 1;
      itemMap[name].revenue += (it.price || it.menuItem?.price || 0) * (it.quantity || 1);
    });
  });
  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const deadItems = Object.entries(itemMap)
    .filter(([, v]) => v.count === 0)
    .map(([k]) => k)
    .slice(0, 3);

  return {
    total: orders.length, confirmed: confirmed.length,
    delivered: delivered.length, cancelled: cancelled.length,
    rejected: rejected.length, pending: pending.length,
    revenue, avgOrder, peakHour, peakDay,
    deliveryCount, pickupCount, topItems, deadItems,
    acceptRate: orders.length ? Math.round((confirmed.length / orders.length) * 100) : 0,
  };
}

function buildStatsText(title, s) {
  let text = `📊 <b>${title}</b>\n\n`;
  text += `📦 <b>Buyurtmalar:</b>\n`;
  text += `• Jami: <b>${s.total}</b>\n`;
  text += `• Tasdiqlangan: <b>${s.confirmed}</b> (${s.acceptRate}%)\n`;
  text += `• Yetkazildi: <b>${s.delivered}</b>\n`;
  text += `• Rad etildi: <b>${s.rejected}</b>\n`;
  text += `• Bekor qilindi: <b>${s.cancelled}</b>\n`;
  text += `• Kutilmoqda: <b>${s.pending}</b>\n\n`;

  text += `💰 <b>Daromad:</b>\n`;
  text += `• Jami: <b>${fmt(s.revenue)} UZS</b>\n`;
  text += `• O'rtacha buyurtma: <b>${fmt(s.avgOrder)} UZS</b>\n\n`;

  text += `⏰ <b>Vaqt tahlili:</b>\n`;
  text += `• Eng band soat: <b>${s.peakHour}:00</b>\n`;
  text += `• Eng band kun: <b>${s.peakDay}</b>\n\n`;

  text += `🚴 <b>Yetkazish:</b>\n`;
  text += `• Yetkazib berish: <b>${s.deliveryCount}</b> ta\n`;
  text += `• Olib ketish: <b>${s.pickupCount}</b> ta\n\n`;

  if (s.topItems.length) {
    text += `🍔 <b>Top 5 taom:</b>\n`;
    s.topItems.forEach(([name, data], i) => {
      text += `${i + 1}. ${name}: <b>${data.count}</b> ta (${fmt(data.revenue)} UZS)\n`;
    });
  }

  return text;
}

async function showStats(ctx) {
  return ctx.reply(
    '📊 <b>Statistika</b>\n\nQaysi davr uchun?',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('📅 Bugun', 'stats_today')],
      [Markup.button.callback('📅 Bu hafta', 'stats_week')],
      [Markup.button.callback('📅 Bu oy', 'stats_month')],
      [Markup.button.callback('📅 Barcha vaqt', 'stats_all')],
    ])}
  );
}

async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery('Yuklanmoqda...');

  const now = new Date();
  let from, to = now.toISOString(), title;

  if (data === 'stats_today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    title = 'Bugungi statistika';
  } else if (data === 'stats_week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString();
    title = 'Haftalik statistika';
  } else if (data === 'stats_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    title = 'Oylik statistika';
  } else if (data === 'stats_all') {
    from = new Date('2024-01-01').toISOString();
    title = 'Umumiy statistika';
  } else return;

  try {
    const orders = await getStats(from, to);
    const s = calcStats(orders);
    const text = buildStatsText(title, s);
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📅 Bugun', 'stats_today'), Markup.button.callback('📅 Hafta', 'stats_week')],
        [Markup.button.callback('📅 Oy', 'stats_month'), Markup.button.callback('📅 Barchasi', 'stats_all')],
      ])
    });
  } catch (err) {
    ctx.reply(`❌ Xatolik: ${err.message}`);
  }
}

module.exports = { statsHandler: { showStats, handleCallback } };
