const { getBotUser } = require('../db');
const { OWNER_ID } = require('../config');

// Rolni tekshirish middleware
function checkRole(allowedRoles) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Owner har doim ruxsat etilgan
    if (userId === OWNER_ID) {
      ctx.userRole = 'owner';
      return next();
    }

    try {
      const user = await getBotUser(userId);
      if (!user || !user.is_active) {
        return ctx.reply('⛔ Sizda bu amalni bajarish huquqi yo\'q.');
      }
      if (!allowedRoles.includes(user.role)) {
        return ctx.reply('⛔ Bu bo\'lim sizning rolingiz uchun emas.');
      }
      ctx.userRole = user.role;
      ctx.botUser = user;
      return next();
    } catch (err) {
      console.error('Auth xatosi:', err.message);
      return ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    }
  };
}

// Foydalanuvchi rolini aniqlash (middleware emas, helper)
async function getUserRole(userId) {
  if (userId === OWNER_ID) return 'owner';
  try {
    const user = await getBotUser(userId);
    if (!user || !user.is_active) return null;
    return user.role;
  } catch {
    return null;
  }
}

// Rol tekshirish funksiyasi
async function hasRole(userId, roles) {
  const role = await getUserRole(userId);
  if (!role) return false;
  return roles.includes(role);
}

module.exports = { checkRole, getUserRole, hasRole };
