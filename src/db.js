const { createClient } = require('@supabase/supabase-js');

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

module.exports = {
  supabase,
  // Menyu
  getCategories, addCategory, deleteCategory,
  getMenuItems, getMenuItem, addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItem,
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
};
