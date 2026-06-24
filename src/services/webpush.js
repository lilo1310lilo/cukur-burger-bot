const webpush = require('web-push');
const { getPushSubscriptions, deletePushSubscription } = require('../db');

let enabled = false;

// VAPID kalitlari mavjud bo'lsa web-push ni sozlaymiz.
// Kalitlarni generatsiya qilish:  npx web-push generate-vapid-keys
function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@cukurburger.uz';

  if (!publicKey || !privateKey) {
    console.warn('⚠️ VAPID kalitlari yo\'q — Web Push o\'chirilgan. (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
    return;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    enabled = true;
    console.log('🔔 Web Push yoqildi');
  } catch (err) {
    console.error('Web Push sozlashda xatolik:', err.message);
  }
}

const STATUS_PUSH = {
  confirmed: { title: 'Buyurtmangiz tasdiqlandi ✅', body: 'To\'lovingiz qabul qilindi, tez orada tayyorlanadi.' },
  preparing: { title: 'Tayyorlanmoqda 👨‍🍳', body: 'Buyurtmangiz oshxonada tayyorlanmoqda.' },
  shipping:  { title: 'Yo\'lda 🚴', body: 'Kuryer buyurtmangiz bilan yo\'lga chiqdi!' },
  delivered: { title: 'Yetkazildi 🎉', body: 'Buyurtmangiz yetkazildi. Yoqimli ishtaha!' },
  rejected:  { title: 'Buyurtma rad etildi ❌', body: 'To\'lov tasdiqlanmadi. Saytda yangi chek yuboring.' },
  cancelled: { title: 'Buyurtma bekor qilindi 🚫', body: 'Buyurtmangiz bekor qilindi.' },
};

// Buyurtma holati o'zgarganda obunalarga push yuborish
async function notifyOrderStatus(order) {
  if (!enabled || !order?.order_number) return;
  const payloadMeta = STATUS_PUSH[order.status];
  if (!payloadMeta) return;

  const subs = await getPushSubscriptions(order.order_number);
  if (!subs.length) return;

  const payload = JSON.stringify({
    title: `#${order.order_number} — ${payloadMeta.title}`,
    body: payloadMeta.body,
    orderNumber: order.order_number,
  });

  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
    } catch (err) {
      // 404/410 — obuna eskirgan, o'chiramiz
      if (err.statusCode === 404 || err.statusCode === 410) {
        await deletePushSubscription(row.id);
      } else {
        console.error('Push yuborishda xatolik:', err.message);
      }
    }
  }));
}

module.exports = { initWebPush, notifyOrderStatus, isWebPushEnabled: () => enabled };
