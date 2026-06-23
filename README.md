# 🍔 Çukur Burger — Telegram Bot

## O'rnatish

```bash
npm install
cp .env.example .env
# .env faylni to'ldiring
```

## .env to'ldirish

```
BOT_TOKEN=yangi_bot_tokeningiz
WEBHOOK_URL=https://sizning-railway-url.up.railway.app
SUPABASE_URL=https://fkotsvrpekkcelmhhnlc.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
OWNER_ID=1869515752
```

## Supabase sozlash

1. supabase/schema.sql faylini SQL Editor ga ko'chiring va ishga tushiring
2. Storage → New bucket → "receipts" (Public: false)

## Railway Deploy

1. GitHub ga push qiling
2. Railway → New Project → GitHub repo tanlang
3. Environment Variables ga .env qiymatlarini kiriting
4. Deploy bo'lgach WEBHOOK_URL ni Railway URL bilan yangilang

## Webhook o'rnatish

Deploy qilingandan keyin:
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url={RAILWAY_URL}/webhook/{TOKEN}
```
