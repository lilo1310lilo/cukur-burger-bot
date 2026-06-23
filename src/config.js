module.exports = {
  OWNER_ID: parseInt(process.env.OWNER_ID || '1869515752'),
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  PORT: parseInt(process.env.PORT || '3000'),

  // Buyurtma holatlari
  ORDER_STATUS: {
    PENDING:    'pending',
    CONFIRMED:  'confirmed',
    PREPARING:  'preparing',
    SHIPPING:   'shipping',
    DELIVERED:  'delivered',
    CANCELLED:  'cancelled',
    REJECTED:   'rejected',
  },

  // Status emoji va nomlari
  STATUS_LABELS: {
    pending:   '⏳ Tekshirilmoqda',
    confirmed: '✅ Tasdiqlandi',
    preparing: '👨‍🍳 Tayyorlanmoqda',
    shipping:  '🚴 Yo\'lda',
    delivered: '🎉 Yetkazildi',
    cancelled: '🚫 Bekor qilindi',
    rejected:  '❌ Rad etildi',
  },

  // Yetkazib berish
  DELIVERY: {
    MAX_FILE_SIZE_MB: 5,
    MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
    URGANCH_BOUNDS: {
      minLat: 41.45,
      maxLat: 41.65,
      minLng: 60.50,
      maxLng: 60.75,
    },
  },

  // Manager navbat vaqti (soniyada)
  MANAGER_TIMEOUT_SEC: 300, // 5 daqiqa
};
