// HTML maxsus belgilarini ekranlash — parse_mode: 'HTML' bilan xavfsiz ishlatish uchun.
// Foydalanuvchi kiritgan matn (ism, manzil, izoh, badge, ...) Telegram HTML ni buzmasligi
// yoki inyeksiya qilmasligi uchun barcha matnlar shu funksiya orqali o'tkaziladi.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { escapeHtml };
