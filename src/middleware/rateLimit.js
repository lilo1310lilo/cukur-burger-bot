// Oddiy per-user rate limiting (xotirada). Spam / tasodifiy ko'p bosishlardan himoya.
// Har bir foydalanuvchi uchun belgilangan oyna ichida ruxsat etilgan so'rovlar soni.
function rateLimit({ windowMs = 1000, max = 5 } = {}) {
  const hits = new Map(); // userId -> [timestamps]

  // Vaqti-vaqti bilan eski yozuvlarni tozalash (xotira oqishining oldini olish)
  setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of hits.entries()) {
      const fresh = times.filter(t => now - t < windowMs);
      if (fresh.length) hits.set(userId, fresh);
      else hits.delete(userId);
    }
  }, 60000).unref?.();

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const times = (hits.get(userId) || []).filter(t => now - t < windowMs);
    times.push(now);
    hits.set(userId, times);

    if (times.length > max) {
      // Juda ko'p so'rov — jim o'tkazib yuboramiz (callback bo'lsa javob beramiz)
      if (ctx.callbackQuery) {
        try { await ctx.answerCbQuery('⏳ Birozdan keyin urinib ko\'ring'); } catch {}
      }
      return; // next() chaqirmaymiz — so'rov bloklanadi
    }
    return next();
  };
}

module.exports = { rateLimit };
