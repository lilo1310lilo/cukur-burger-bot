const { getSession, setSession, deleteSession } = require('../db');

// Telegraf session uchun Supabase- backed store.
// Sabab: standart `session()` xotirada (in-memory) saqlaydi — bot/Railway qayta
// ishga tushganda barcha sessiyalar (wizard holati, awaitingField, ...) yo'qoladi.
// Bu store sessiyalarni `bot_sessions` jadvalida saqlaydi.
//
// Telegraf v4 async store interfeysi: { get, set, delete }
const supabaseSessionStore = {
  async get(key) {
    try {
      return await getSession(key);
    } catch (err) {
      console.error('Session get xatosi:', err.message);
      return undefined;
    }
  },
  async set(key, value) {
    try {
      await setSession(key, value);
    } catch (err) {
      console.error('Session set xatosi:', err.message);
    }
  },
  async delete(key) {
    try {
      await deleteSession(key);
    } catch (err) {
      console.error('Session delete xatosi:', err.message);
    }
  },
};

module.exports = { supabaseSessionStore };
