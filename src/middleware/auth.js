const { getBotUser } = require('../db');
const { OWNER_ID } = require('../config');

// Global middleware: faqat ruxsat etilgan foydalanuvchilarni o'tkazadi
async function globalAuth(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return next();

  if (userId === OWNER_ID) {
    ctx.userRole = 'owner';
    return next();
  }

  try {
    const user = await getBotUser(userId);
    if (!user || !user.is_active) {
      // Notanish foydalanuvchini e'tiborsiz qoldirish (hech qanday javob bermaslik)
      return;
    }
    ctx.userRole = user.role;
    ctx.botUser = user;
    return next();
  } catch (err) {
    // Xatolikda ham javob bermaydi
    return;
  }
}

// Rolni tekshirish middleware
function checkRole(allowedRoles) {
  return async (ctx, next) => {
    // globalAuth orqali userRole aniqlangan bo'lishi kerak
    if (!ctx.userRole) return; 

    if (ctx.userRole === 'owner') {
      return next();
    }

    if (!allowedRoles.includes(ctx.userRole)) {
      return ctx.reply('⛔ Bu bo\'lim sizning rolingiz uchun emas.');
    }
    return next();
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

module.exports = { globalAuth, checkRole, getUserRole, hasRole };
