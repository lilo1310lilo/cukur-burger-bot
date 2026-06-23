-- =============================================
-- ÇUKUR BURGER — Supabase Database Schema
-- Supabase SQL Editor ga to'liq ko'chirib ishga tushiring
-- =============================================

-- 1. KATEGORIYALAR
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_uz TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MENYU ELEMENTLARI
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_uz TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  description_uz TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ru TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT true,
  badge TEXT DEFAULT '',
  spicy_level INTEGER DEFAULT 0 CHECK (spicy_level BETWEEN 0 AND 3),
  weight TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BUYURTMALAR
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION DEFAULT 0,
  lng DOUBLE PRECISION DEFAULT 0,
  delivery_type TEXT NOT NULL DEFAULT 'delivery' CHECK (delivery_type IN ('delivery','pickup')),
  items JSONB NOT NULL DEFAULT '[]',
  total_price INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','shipping','delivered','cancelled','rejected')),
  receipt_telegram_file_id TEXT DEFAULT '',
  cancel_reason TEXT DEFAULT '',
  cancelled_by TEXT DEFAULT '' CHECK (cancelled_by IN ('','customer','manager')),
  assigned_manager_id BIGINT DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SAYT SOZLAMALARI (kalit-qiymat)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOT FOYDALANUVCHILARI (owner, admin, manager)
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id BIGINT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','manager')),
  name TEXT DEFAULT '',
  username TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. KAFE ISH JADVALI
CREATE TABLE IF NOT EXISTS cafe_schedule (
  day INTEGER PRIMARY KEY CHECK (day BETWEEN 1 AND 7),
  day_name TEXT NOT NULL,
  is_open BOOLEAN DEFAULT true,
  open_time TEXT DEFAULT '10:00',
  close_time TEXT DEFAULT '05:00',
  is_holiday BOOLEAN DEFAULT false
);

-- =============================================
-- BOSHLANG'ICH MA'LUMOTLAR
-- =============================================

-- Ish jadvali (1=Dushanba ... 7=Yakshanba)
INSERT INTO cafe_schedule (day, day_name, is_open, open_time, close_time) VALUES
  (1, 'Dushanba', true, '10:00', '05:00'),
  (2, 'Seshanba', true, '10:00', '05:00'),
  (3, 'Chorshanba', true, '10:00', '05:00'),
  (4, 'Payshanba', true, '10:00', '05:00'),
  (5, 'Juma', true, '10:00', '05:00'),
  (6, 'Shanba', true, '10:00', '05:00'),
  (7, 'Yakshanba', true, '10:00', '05:00')
ON CONFLICT (day) DO NOTHING;

-- Boshlang'ich sayt sozlamalari
INSERT INTO site_settings (key, value) VALUES
  ('payment_card_number', '0000 0000 0000 0000'),
  ('payment_card_owner', 'Ism Familiya'),
  ('delivery_fee', '15000'),
  ('min_order_amount', '0'),
  ('cafe_address_uz', 'Urganch sh., Manzil'),
  ('cafe_address_en', 'Urgench city, Address'),
  ('cafe_address_ru', 'г. Ургенч, Адрес'),
  ('cafe_phone', '+998 XX XXX XX XX'),
  ('cafe_lat', '41.5498'),
  ('cafe_lng', '60.6308'),
  ('hero_title_uz', 'San''at darajasidagi lazzat.'),
  ('hero_title_en', 'Art-Level Mastered Flavors.'),
  ('hero_title_ru', 'Вкусы уровня искусства.'),
  ('hero_desc_uz', 'Urganch shahrining eng mazali burgerlari.'),
  ('hero_desc_en', 'The most delicious burgers in Urgench city.'),
  ('hero_desc_ru', 'Самые вкусные бургеры в городе Ургенч.'),
  ('about_text_uz', 'Biz haqimizda matn.'),
  ('about_text_en', 'About us text.'),
  ('about_text_ru', 'О нас текст.'),
  ('promo_active', 'false'),
  ('promo_text_uz', 'Aksiya matni'),
  ('promo_text_en', 'Promo text'),
  ('promo_text_ru', 'Текст акции'),
  ('cafe_open', 'true')
ON CONFLICT (key) DO NOTHING;

-- Owner ni qo'shish (bot_users ga)
INSERT INTO bot_users (telegram_id, role, name) VALUES
  (1869515752, 'owner', 'Owner')
ON CONFLICT (telegram_id) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;

-- Kategoriyalar: hammaga o'qish, faqat service_role yozish
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_write" ON categories FOR ALL USING (auth.role() = 'service_role');

-- Menyu: hammaga o'qish, faqat service_role yozish
CREATE POLICY "menu_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_write" ON menu_items FOR ALL USING (auth.role() = 'service_role');

-- Buyurtmalar: yaratish hammaga, o'qish faqat service_role
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select_own" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.role() = 'service_role');

-- Sozlamalar: hammaga o'qish, faqat service_role yozish
CREATE POLICY "settings_read" ON site_settings FOR SELECT USING (true);
CREATE POLICY "settings_write" ON site_settings FOR ALL USING (auth.role() = 'service_role');

-- Jadval: hammaga o'qish
CREATE POLICY "schedule_read" ON cafe_schedule FOR SELECT USING (true);
CREATE POLICY "schedule_write" ON cafe_schedule FOR ALL USING (auth.role() = 'service_role');

-- Bot users: faqat service_role
CREATE POLICY "bot_users_all" ON bot_users FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGER: updated_at avtomatik yangilansin
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- SUPABASE STORAGE (Fayl yuklash)
-- =============================================
-- Supabase Dashboard → Storage → "New bucket"
-- Bucket nomi: receipts
-- Public: FALSE (xavfsizlik uchun)
-- File size limit: 5MB
-- =============================================
