-- Services from dexelsa.com and artxel.co, with categories and starting prices, for fast invoice classification.
-- Names are English because they print on the English invoice paper; the Arabic description shows in the app.
-- Prices are defaults (used to split an invoice amount between services); they can be edited in the catalog.

INSERT INTO catalog_categories (name, color, sort) SELECT 'هوية بصرية', '#7c3aed', 10 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'هوية بصرية');
INSERT INTO catalog_categories (name, color, sort) SELECT 'سوشيال ميديا', '#db2777', 11 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'سوشيال ميديا');
INSERT INTO catalog_categories (name, color, sort) SELECT 'مطبوعات وتغليف', '#ea580c', 12 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'مطبوعات وتغليف');
INSERT INTO catalog_categories (name, color, sort) SELECT 'مواقع وتطبيقات', '#2563eb', 13 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'مواقع وتطبيقات');
INSERT INTO catalog_categories (name, color, sort) SELECT 'معارض وفعاليات', '#0891b2', 14 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'معارض وفعاليات');
INSERT INTO catalog_categories (name, color, sort) SELECT 'منتجات العلامة', '#16a34a', 15 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'منتجات العلامة');
INSERT INTO catalog_categories (name, color, sort) SELECT 'عروض وموشن', '#f59e0b', 16 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'عروض وموشن');
INSERT INTO catalog_categories (name, color, sort) SELECT 'باقات', '#4f46e5', 17 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'باقات');

-- Services that came in with the imported payment files: assign each to its store (only if no other store uses it) and a category.
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'DEXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), description = COALESCE(description, 'الهوية البصرية والعلامة التجارية (الخدمة الكاملة)'), default_price = COALESCE(default_price, 2500) WHERE name = 'Brand identity' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'DEXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'DEXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'مواقع وتطبيقات' ORDER BY id LIMIT 1), description = COALESCE(description, 'تصميم واجهات موقع أو تطبيق حتى 5 صفحات'), default_price = COALESCE(default_price, 3500) WHERE name = 'Websites & apps' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'DEXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'DEXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), description = COALESCE(description, 'المطبوعات والتغليف'), default_price = COALESCE(default_price, 800) WHERE name = 'Print & packaging' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'DEXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'ARTXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), description = COALESCE(description, 'الهوية البصرية والشعار (الخدمة الكاملة)'), default_price = COALESCE(default_price, 2500) WHERE name = 'Branding' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'ARTXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'ARTXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), description = COALESCE(description, 'تصميم مطبوعة واحدة: بروشور، فلاير، قائمة، بطاقة'), default_price = COALESCE(default_price, 350) WHERE name = 'Print' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'ARTXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'ARTXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), description = COALESCE(description, 'تصميم عبوة أو ملصق منتج'), default_price = COALESCE(default_price, 1800) WHERE name = 'Packaging' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'ARTXEL');
UPDATE catalog_items SET store_id = (SELECT id FROM stores WHERE name = 'ARTXEL'), category_id = (SELECT id FROM catalog_categories WHERE name = 'عروض وموشن' ORDER BY id LIMIT 1), description = COALESCE(description, 'عرض تقديمي حتى 15 شريحة'), default_price = COALESCE(default_price, 1200) WHERE name = 'Presentations' AND store_id IS NULL AND id NOT IN (SELECT ii.item_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id WHERE s.name <> 'ARTXEL');
UPDATE catalog_items SET category_id = (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), description = COALESCE(description, 'تصاميم سوشيال ميديا') WHERE name = 'Social media' AND store_id IS NULL;
UPDATE catalog_items SET category_id = NULL, description = COALESCE(description, 'خدمة تصميم أخرى') WHERE name = 'Other' AND store_id IS NULL;

-- DEXEL
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Logo design', 'تصميم الشعار وتنويعاته (3 اتجاهات أولية)', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 1500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Logo design' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand guidelines', 'دليل الهوية البصرية', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 800 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand guidelines' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand applications', 'تطبيقات الهوية على القرطاسية والمنصات الرقمية', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand applications' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Social media monthly (12 designs)', 'باقة السوشيال ميديا الشهرية: 12 تصميماً وقوالب وأغلفة هايلايت', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 1200 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Social media monthly (12 designs)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Social media post', 'تصميم منشور أو قصة سوشيال ميديا', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 100 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Social media post' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Ad campaign designs', 'تصاميم حملة إعلانية', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 600 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Ad campaign designs' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Profile covers & highlights', 'أغلفة الحسابات والهايلايت', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 300 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Profile covers & highlights' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Packaging / label design', 'تصميم عبوة أو ملصق منتج', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), s.id, 800 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Packaging / label design' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Company profile / brochure', 'بروفايل الشركة والكتيبات', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), s.id, 1200 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Company profile / brochure' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Business cards & stationery', 'القرطاسية وبطاقات العمل', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), s.id, 400 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Business cards & stationery' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Signage / printed ad', 'اللوحات والإعلانات المطبوعة', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), s.id, 400 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Signage / printed ad' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Extra page / screen', 'صفحة أو شاشة إضافية لموقع أو تطبيق', (SELECT id FROM catalog_categories WHERE name = 'مواقع وتطبيقات' ORDER BY id LIMIT 1), s.id, 500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Extra page / screen' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Exhibition booth design', 'تصميم جناح معرض حتى 9 م² مع المحاكاة', (SELECT id FROM catalog_categories WHERE name = 'معارض وفعاليات' ORDER BY id LIMIT 1), s.id, 3000 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Exhibition booth design' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Event identity', 'هوية الفعالية', (SELECT id FROM catalog_categories WHERE name = 'معارض وفعاليات' ORDER BY id LIMIT 1), s.id, 1500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Event identity' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Event signage & backdrops', 'اللوحات والخلفيات الإرشادية للفعالية', (SELECT id FROM catalog_categories WHERE name = 'معارض وفعاليات' ORDER BY id LIMIT 1), s.id, 800 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Event signage & backdrops' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand merchandise (up to 5 items)', 'هدايا ومنتجات العلامة حتى 5 منتجات', (SELECT id FROM catalog_categories WHERE name = 'منتجات العلامة' ORDER BY id LIMIT 1), s.id, 600 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand merchandise (up to 5 items)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Uniform & ID badges', 'الزي الموحد وبطاقات التعريف', (SELECT id FROM catalog_categories WHERE name = 'منتجات العلامة' ORDER BY id LIMIT 1), s.id, 400 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Uniform & ID badges' AND ci.store_id = s.id);

-- ARTXEL
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Logo design', 'تصميم الشعار (2–3 اتجاهات مبدئية)', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 1500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Logo design' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand guidelines', 'دليل استخدام الهوية (Brand Guidelines)', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 800 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand guidelines' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Stationery templates', 'بطاقة أعمال وترويسة وتوقيع بريد', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 400 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Stationery templates' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Social media designs (10)', 'حزمة 10 تصاميم سوشيال ميديا', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 900 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Social media designs (10)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Social media post', 'تصميم منشور أو ستوري', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 90 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Social media post' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Social media management (monthly)', 'باقة إدارة تصميم السوشيال الشهرية: 16 منشوراً و8 ستوري وتصميم متحرك', (SELECT id FROM catalog_categories WHERE name = 'سوشيال ميديا' ORDER BY id LIMIT 1), s.id, 3000 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Social media management (monthly)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Website / store UI (up to 5 pages)', 'تصميم واجهات موقع أو متجر حتى 5 صفحات', (SELECT id FROM catalog_categories WHERE name = 'مواقع وتطبيقات' ORDER BY id LIMIT 1), s.id, 4500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Website / store UI (up to 5 pages)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Motion graphics / reel (up to 30s)', 'موشن جرافيك أو ريلز حتى 30 ثانية', (SELECT id FROM catalog_categories WHERE name = 'عروض وموشن' ORDER BY id LIMIT 1), s.id, 1500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Motion graphics / reel (up to 30s)' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Launch package', 'باقة الإطلاق: شعار وأساسيات هوية وقوالب سوشيال', (SELECT id FROM catalog_categories WHERE name = 'باقات' ORDER BY id LIMIT 1), s.id, 3500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Launch package' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Full identity package', 'باقة الهوية الكاملة مع دليل الهوية', (SELECT id FROM catalog_categories WHERE name = 'باقات' ORDER BY id LIMIT 1), s.id, 6500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Full identity package' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand + social package', 'باقة العلامة + سوشيال: هوية كاملة وشهر أول سوشيال', (SELECT id FROM catalog_categories WHERE name = 'باقات' ORDER BY id LIMIT 1), s.id, 9500 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand + social package' AND ci.store_id = s.id);
