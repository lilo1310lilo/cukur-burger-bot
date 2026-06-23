const { supabase, getManagerIds, getOrder } = require('../db');
const { sendOrderNotification } = require('../handlers/manager/orders');
const { MANAGER_TIMEOUT_SEC } = require('../config');
const axios = require('axios');

let botInstance = null;

// Qaysi managerga navbat (ketma-ket yuborish uchun)
const pendingOrders = new Map(); // orderId → { managerIndex, timers[] }

// ─── BOT INSTANCE O'RNATISH ────────────────────────────
function setBotInstance(bot) {
  botInstance = bot;
}

// ─── SUPABASE STORAGE DAN FAYLNI YUKLAB OLISH ────────
async function downloadAndSendReceipt(order, managerId) {
  if (!order.receipt_telegram_file_id) return null;

  // Agar Telegram file_id bo'lsa (avval yuborilgan)
  if (order.receipt_telegram_file_id.startsWith('AgAC') ||
      order.receipt_telegram_file_id.startsWith('BAAC') ||
      order.receipt_telegram_file_id.length > 40) {
    // Bu Telegram file_id — to'g'ridan-to'g'ri yuborish
    try {
      await botInstance.telegram.sendDocument(managerId, order.receipt_telegram_file_id, {
        caption: `📎 Buyurtma #${order.order_number} — Chek`,
      });
      return order.receipt_telegram_file_id;
    } catch (err) {
      console.error('Chek yuborishda xatolik:', err.message);
      return null;
    }
  }

  // Agar Supabase Storage URL bo'lsa
  if (order.receipt_telegram_file_id.startsWith('http')) {
    try {
      const response = await axios.get(order.receipt_telegram_file_id, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const buffer = Buffer.from(response.data);
      const fileName = `receipt_${order.order_number}.jpg`;

      const sentMsg = await botInstance.telegram.sendDocument(managerId,
        { source: buffer, filename: fileName },
        { caption: `📎 Buyurtma #${order.order_number} — Chek` }
      );

      // Supabase Storage dan o'chirish
      try {
        const urlPath = order.receipt_telegram_file_id.split('/storage/v1/object/public/receipts/')[1];
        if (urlPath) {
          await supabase.storage.from('receipts').remove([urlPath]);
          console.log(`✅ Fayl Supabase Storage dan o'chirildi: ${urlPath}`);
        }
      } catch (delErr) {
        console.error('Faylni o\'chirishda xatolik:', delErr.message);
      }

      // Telegram file_id ni saqlash (keyingi managerga tez yuborish uchun)
      const tgFileId = sentMsg.document?.file_id;
      if (tgFileId) {
        await supabase
          .from('orders')
          .update({ receipt_telegram_file_id: tgFileId })
          .eq('id', order.id);
      }

      return tgFileId;
    } catch (err) {
      console.error('Chek URL yuklab olishda xatolik:', err.message);
      return null;
    }
  }

  return null;
}

// ─── MANAGERGA BUYURTMA YUBORISH ─────────────────────
async function notifyNextManager(orderId) {
  if (!botInstance) return;

  try {
    const order = await getOrder(orderId);
    if (!order || order.status !== 'pending') {
      // Buyurtma allaqachon tasdiqlangan yoki bekor qilingan
      cleanupOrder(orderId);
      return;
    }

    const managers = await getManagerIds();
    if (!managers.length) {
      console.error('❌ Hech qanday manager topilmadi!');
      return;
    }

    const state = pendingOrders.get(orderId) || { managerIndex: 0, timers: [] };
    const idx = state.managerIndex % managers.length;
    const managerId = managers[idx];

    console.log(`📨 Buyurtma #${order.order_number} → Manager ${managerId} (${idx + 1}/${managers.length})`);

    // Chekni yuborish + buyurtma xabari
    await downloadAndSendReceipt(order, managerId);
    await sendOrderNotification(botInstance, order, managerId);

    // Keyingi manager uchun timeout
    if (managers.length > 1) {
      const timer = setTimeout(async () => {
        // Hali ham pending bo'lsa — keyingi managerga
        try {
          const currentOrder = await getOrder(orderId);
          if (currentOrder?.status === 'pending') {
            const newState = pendingOrders.get(orderId);
            if (newState) {
              newState.managerIndex = (idx + 1) % managers.length;
              pendingOrders.set(orderId, newState);
            }
            await notifyNextManager(orderId);
          } else {
            cleanupOrder(orderId);
          }
        } catch {}
      }, MANAGER_TIMEOUT_SEC * 1000);

      state.timers.push(timer);
    }

    state.managerIndex = idx;
    pendingOrders.set(orderId, state);

  } catch (err) {
    console.error('notifyNextManager xatosi:', err.message);
  }
}

function cleanupOrder(orderId) {
  const state = pendingOrders.get(orderId);
  if (state?.timers) {
    state.timers.forEach(t => clearTimeout(t));
  }
  pendingOrders.delete(orderId);
}

// ─── SUPABASE REALTIME — YANGI BUYURTMALARNI KUZATISH ─
function startNotificationService() {
  if (!supabase) {
    console.error('❌ Supabase client yo\'q!');
    return;
  }

  // Realtime subscription
  const channel = supabase
    .channel('orders_channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
    }, async (payload) => {
      const order = payload.new;
      console.log(`🆕 Yangi buyurtma: #${order.order_number}`);

      if (order.status === 'pending') {
        // Bir oz kutish — fayl storage ga yozilishi uchun
        setTimeout(() => {
          notifyNextManager(order.id);
        }, 2000);
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
    }, (payload) => {
      const order = payload.new;
      // Buyurtma tasdiqlandi/rad etildi — timerlarni tozalash
      if (['confirmed', 'rejected', 'cancelled'].includes(order.status)) {
        cleanupOrder(order.id);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Supabase Realtime ulandi');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Supabase Realtime xatosi — polling rejimiga o\'tildi');
        startPollingFallback();
      }
    });

  return channel;
}

// ─── POLLING FALLBACK (Realtime ishlamasa) ────────────
let lastCheckedAt = new Date().toISOString();

function startPollingFallback() {
  console.log('🔄 Polling fallback ishga tushdi (har 10 soniyada)');

  setInterval(async () => {
    try {
      const { data: newOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .gt('created_at', lastCheckedAt)
        .order('created_at');

      if (newOrders?.length) {
        lastCheckedAt = new Date().toISOString();
        for (const order of newOrders) {
          if (!pendingOrders.has(order.id)) {
            console.log(`🔄 Polling: Yangi buyurtma #${order.order_number}`);
            await notifyNextManager(order.id);
          }
        }
      }
    } catch (err) {
      console.error('Polling xatosi:', err.message);
    }
  }, 10000);
}

module.exports = { startNotificationService, setBotInstance, cleanupOrder };
