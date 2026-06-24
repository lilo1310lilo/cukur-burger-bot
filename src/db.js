const { createClient } = require('@supabase/supabase-js');

// ─── SUPABASE KALITINI TEKSHIRISH ────────────────────
// Muammo: bot site_settings / orders / menu_items ga YOZADI. schema.sql dagi RLS
// policy lari (masalan settings_write) faqat `auth.role() = 'service_role'` ga
// ruxsat beradi. Agar bot xato bilan ANON / PUBLISHABLE kalit ishlatsa, har qanday
// yozish (to'lov sozlamalarini saqlash, buyurtma statusini yangilash) RLS tomonidan
// rad etiladi. Shuning uchun ishga tushishda kalitni qattiq tekshiramiz.
function validateServiceKey(url, key) {
  if (!url) {
    throw new Error(
      'SUPABASE_URL .env da yo\'q! Railway > Variables ga SUPABASE_URL ni qo\'shing.'
    );
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_KEY .env da yo\'q! Supabase > Settings > API > "service_role" / "secret" kalitini (sb_secret_...) qo\'shing. ' +
      'DIQQAT: publishable/anon kalit EMAS — bot yozish uchun service_role kalitini talab qiladi.'
    );
  }
  // Yangi format: publishable (public) kalit — bu noto'g'ri, bot uchun ishlamaydi
  if (key.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SERVICE_KEY publishable (public) kalit qiymatiga ega! ' +
      'Bu kalit faqat sayt(frontend) uchun. Bot uchun Supabase > Settings > API dan ' +
      '"secret" kalitni (sb_secret_...) yoki "service_role" kalitni ishlating. ' +
      'Aks holda RLS yozishni rad etadi (masalan to\'lov sozlamalarini saqlashda xatolik).'
    );
  }
  // Legacy JWT format (eyJ...) — payload dagi role ni tekshiramiz
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
      if (payload.role && payload.role !== 'service_role') {
        throw new Error(
          `SUPABASE_SERVICE_KEY noto'g'ri rolga ega: "${payload.role}". ` +
          'Bot service_role kalitini talab qiladi (anon EMAS). ' +
          'Supabase > Settings > API > service_role kalitini ishlating.'
        );
      }
    } catch (e) {
      if (e.message.includes('noto\'g\'ri rolga')) throw e;
      // Dekod qilib bo'lmasa — ogohlantirish, lekin to'xtatmaymiz
      console.warn('⚠️ SUPABASE_SERVICE_KEY ni tekshirib bo\'lmadi (JWT dekod xatosi).');
    }
  }
}

validateServiceKey(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

// ─── MENYU ───────────────────────────────────────────
async function getCategories() {
  const { data, error } = await supabase
    .from('categories').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

async function addCategory(nameUz, nameEn, nameRu) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name_uz: nameUz, name_en: nameEn, name_ru: nameRu })
    .select().single();
  if (error) throw error;
  return data;
}

async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

async function getMenuItems(categoryId = null) {
  let q = supabase.from('menu_items').select('*, categories(name_uz)').order('sort_order');
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function getMenuItem(id) {
  const { data, error } = await supabase
    .from('menu_items').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function addMenuItem(item) {
  const { data, error } = await supabase
    .from('menu_items').insert(item).select().single();
  if (error) throw error;
  return data;
}

async function updateMenuItem(id, updates) {
  const { data, error } = await supabase
    .from('menu_items').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteMenuItem(id) {
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) throw error;
}

async function toggleMenuItem(id, isAvailable) {
  const { error } = await supabase
    .from('menu_items').update({ is_available: isAvailable }).eq('id', id);
  if (error) throw error;
}

// ─── BUYURTMALAR ─────────────────────────────────────
async function getOrder(id) {
  const { data, error } = await supabase
    .from('orders').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function getOrderByNumber(orderNumber) {
  const { data, error } = await supabase
    .from('orders').select('*').eq('order_number', orderNumber).single();
  if (error) throw error;
  return data;
}

async function updateOrderStatus(id, status, extra = {}) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, ...extra })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function getPendingOrders() {
  const { data, error } = await supabase
    .from('orders').select('*').eq('status', 'pending').order('created_at');
  if (error) throw error;
  return data;
}

async function getOrders(status = null, limit = 20) {
  let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ─── SOZLAMALAR ──────────────────────────────────────
async function getSetting(key) {
  const { data, error } = await supabase
    .from('site_settings').select('value').eq('key', key).single();
  if (error) return null;
  return data?.value ?? null;
}

async function getSettings(keys) {
  const { data, error } = await supabase
    .from('site_settings').select('key, value').in('key', keys);
  if (error) throw error;
  const result = {};
  data.forEach(r => { result[r.key] = r.value; });
  return result;
}

async function setSetting(key, value) {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function getAllSettings() {
  const { data, error } = await supabase.from('site_settings').select('*');
  if (error) throw error;
  const result = {};
  data.forEach(r => { result[r.key] = r.value; });
  return result;
}

// ─── BOT FOYDALANUVCHILARI ────────────────────────────
async function getBotUsers() {
  const { data, error } = await supabase
    .from('bot_users').select('*').eq('is_active', true).order('role');
  if (error) throw error;
  return data;
}

async function getBotUser(telegramId) {
  const { data, error } = await supabase
    .from('bot_users').select('*').eq('telegram_id', telegramId).single();
  if (error) return null;
  return data;
}

async function addBotUser(telegramId, role, name = '', username = '') {
  const { error } = await supabase
    .from('bot_users')
    .upsert({ telegram_id: telegramId, role, name, username, is_active: true });
  if (error) throw error;
}

async function removeBotUser(telegramId) {
  const { error } = await supabase
    .from('bot_users').update({ is_active: false }).eq('telegram_id', telegramId);
  if (error) throw error;
}

async function getManagerIds() {
  const { data, error } = await supabase
    .from('bot_users')
    .select('telegram_id')
    .in('role', ['manager', 'admin', 'owner'])
    .eq('is_active', true);
  if (error) return [];
  return data.map(u => u.telegram_id);
}

// ─── JADVAL ───────────────────────────────────────────
async function getSchedule() {
  const { data, error } = await supabase
    .from('cafe_schedule').select('*').order('day');
  if (error) throw error;
  return data;
}

async function updateScheduleDay(day, updates) {
  const { error } = await supabase
    .from('cafe_schedule').update(updates).eq('day', day);
  if (error) throw error;
}

// ─── STATISTIKA ───────────────────────────────────────
async function getStats(fromDate, toDate) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', fromDate)
    .lte('created_at', toDate);
  if (error) throw error;
  return data;
}

// ─── KUPONLAR / CHEGIRMA KODLARI ─────────────────────
async function getCoupons() {
  const { data, error } = await supabase
    .from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getCoupon(id) {
  const { data, error } = await supabase
    .from('coupons').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function addCoupon(coupon) {
  const payload = { ...coupon, code: String(coupon.code || '').trim().toUpperCase() };
  const { data, error } = await supabase
    .from('coupons').insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function updateCoupon(id, updates) {
  if (updates.code) updates.code = String(updates.code).trim().toUpperCase();
  const { data, error } = await supabase
    .from('coupons').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteCoupon(id) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw error;
}

// ─── BOT SESSION STORE (Supabase orqali — restartda saqlanadi) ──
async function getSession(key) {
  const { data, error } = await supabase
    .from('bot_sessions').select('data').eq('key', key).single();
  if (error) return undefined;
  return data?.data;
}

async function setSession(key, value) {
  const { error } = await supabase
    .from('bot_sessions')
    .upsert({ key, data: value ?? {}, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function deleteSession(key) {
  const { error } = await supabase.from('bot_sessions').delete().eq('key', key);
  if (error) throw error;
}

// ─── WEB PUSH OBUNALARI ──────────────────────────────
async function getPushSubscriptions(orderNumber) {
  const { data, error } = await supabase
    .from('push_subscriptions').select('*').eq('order_number', orderNumber);
  if (error) return [];
  return data;
}

async function deletePushSubscription(id) {
  await supabase.from('push_subscriptions').delete().eq('id', id);
}

// ─── KOMBO / SET MENYULAR ────────────────────────────
async function getCombos() {
  const { data, error } = await supabase
    .from('combos')
    .select('*, combo_items(id, quantity, sort_order, menu_item_id, menu_items(name_uz))')
    .order('sort_order');
  if (error) throw error;
  return data;
}

async function getCombo(id) {
  const { data, error } = await supabase
    .from('combos')
    .select('*, combo_items(id, quantity, sort_order, menu_item_id, menu_items(name_uz))')
    .eq('id', id).single();
  if (error) return null;
  return data;
}

async function addCombo(combo) {
  const { data, error } = await supabase
    .from('combos').insert(combo).select().single();
  if (error) throw error;
  return data;
}

async function updateCombo(id, updates) {
  const { data, error } = await supabase
    .from('combos').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteCombo(id) {
  const { error } = await supabase.from('combos').delete().eq('id', id);
  if (error) throw error;
}

async function toggleCombo(id, isAvailable) {
  const { error } = await supabase
    .from('combos').update({ is_available: isAvailable }).eq('id', id);
  if (error) throw error;
}

async function addComboItem(comboId, menuItemId, quantity = 1) {
  const { error } = await supabase
    .from('combo_items')
    .insert({ combo_id: comboId, menu_item_id: menuItemId, quantity });
  if (error) throw error;
}

async function deleteComboItem(id) {
  const { error } = await supabase.from('combo_items').delete().eq('id', id);
  if (error) throw error;
}

// ─── MAHSULOT SOZLAMALARI (modifikatorlar) ───────────
async function getItemOptions(menuItemId) {
  const { data, error } = await supabase
    .from('menu_item_options')
    .select('*, choices:menu_item_option_choices(*)')
    .eq('menu_item_id', menuItemId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

async function getOption(id) {
  const { data, error } = await supabase
    .from('menu_item_options')
    .select('*, choices:menu_item_option_choices(*)')
    .eq('id', id).single();
  if (error) return null;
  return data;
}

async function addOption(option) {
  const { data, error } = await supabase
    .from('menu_item_options').insert(option).select().single();
  if (error) throw error;
  return data;
}

async function deleteOption(id) {
  const { error } = await supabase.from('menu_item_options').delete().eq('id', id);
  if (error) throw error;
}

async function addOptionChoice(choice) {
  const { data, error } = await supabase
    .from('menu_item_option_choices').insert(choice).select().single();
  if (error) throw error;
  return data;
}

async function deleteOptionChoice(id) {
  const { error } = await supabase.from('menu_item_option_choices').delete().eq('id', id);
  if (error) throw error;
}

module.exports = {
  supabase,
  // Menyu
  getCategories, addCategory, deleteCategory,
  getMenuItems, getMenuItem, addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItem,
  // Kombolar
  getCombos, getCombo, addCombo, updateCombo, deleteCombo, toggleCombo, addComboItem, deleteComboItem,
  // Mahsulot sozlamalari (optionlar)
  getItemOptions, getOption, addOption, deleteOption, addOptionChoice, deleteOptionChoice,
  // Buyurtmalar
  getOrder, getOrderByNumber, updateOrderStatus, getPendingOrders, getOrders,
  // Sozlamalar
  getSetting, getSettings, setSetting, getAllSettings,
  // Bot users
  getBotUsers, getBotUser, addBotUser, removeBotUser, getManagerIds,
  // Jadval
  getSchedule, updateScheduleDay,
  // Statistika
  getStats,
  // Kuponlar
  getCoupons, getCoupon, addCoupon, updateCoupon, deleteCoupon,
  // Session store
  getSession, setSession, deleteSession,
  // Web push
  getPushSubscriptions, deletePushSubscription,
};
