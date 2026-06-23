const axios = require('axios');
const { supabase } = require('../db');

const MENU_BUCKET = 'menu-images';

// Ruxsat etilgan rasm MIME turlari (xavfsizlik — faqat rasm)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function extFromContentType(ct) {
  if (!ct) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
}

// Telegram file_id ni doimiy Supabase Storage public URL ga aylantirish.
//
// Sabab: Telegram fayl URL lari (https://api.telegram.org/file/bot<TOKEN>/<path>)
//   ~1 soatdan keyin eskiradi VA BOT_TOKEN ni URL ichida oshkor qiladi.
//   Shuning uchun rasmni yuklab olib, public `menu-images` bucketiga joylaymiz
//   va menu_items.image_url ga doimiy public URL yozamiz.
//
// Qaytaradi: { url } muvaffaqiyatda yoki xato uloqtiradi.
async function uploadTelegramPhotoToStorage(ctx, fileId) {
  // 1) Telegram dan vaqtinchalik URL olamiz
  const file = await ctx.telegram.getFile(fileId);
  const tgUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  // 2) Faylni yuklab olamiz
  const response = await axios.get(tgUrl, { responseType: 'arraybuffer', timeout: 20000 });
  const buffer = Buffer.from(response.data);

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Rasm hajmi 5MB dan oshmasligi kerak.');
  }

  let contentType = response.headers['content-type'] || 'image/jpeg';
  // Telegram .jpg qaytaradi; MIME ni normalizatsiya qilamiz
  if (!ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) {
    // file_path kengaytmasidan taxmin qilamiz
    if (file.file_path && /\.png$/i.test(file.file_path)) contentType = 'image/png';
    else if (file.file_path && /\.webp$/i.test(file.file_path)) contentType = 'image/webp';
    else contentType = 'image/jpeg';
  }

  const ext = extFromContentType(contentType);
  const fileName = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 3) menu-images bucketiga yuklaymiz
  const { error: uploadError } = await supabase.storage
    .from(MENU_BUCKET)
    .upload(fileName, buffer, { contentType, upsert: false });
  if (uploadError) {
    throw new Error(
      `Rasmni Storage ga yuklashda xatolik: ${uploadError.message}. ` +
      `Supabase da "${MENU_BUCKET}" (public) bucket yaratilganini tekshiring.`
    );
  }

  // 4) Public URL ni olamiz
  const { data: { publicUrl } } = supabase.storage.from(MENU_BUCKET).getPublicUrl(fileName);
  return { url: publicUrl, path: fileName };
}

module.exports = { uploadTelegramPhotoToStorage, MENU_BUCKET, ALLOWED_IMAGE_TYPES };
