-- Invoice review fixes approved by the owner:
--  1) DEXEL 500 invoices with 11 posts at 45.45 (= 499.95) become 10 posts at 50 plus 1 complimentary post (= 500).
--  2) gift lines (price 0) stay; the invoice paper shows them as Complimentary.
--  3) ready-made packs sold at a custom-work price move to new custom design services (same qty and price).
--  4) Motion Graphics & Reels gets a description that fits short and long videos.

INSERT INTO invoice_items (invoice_id, item_id, qty, unit_price, line_note)
SELECT ii.invoice_id, ii.item_id, 1, 0, NULL FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
WHERE ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s ON s.id = ci.store_id WHERE ci.name = 'Social Media Post Design' AND s.name = 'DEXEL' ORDER BY ci.id LIMIT 1) p) AND ii.qty = 11 AND ii.unit_price = 45.45 AND i.amount = 500;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id SET ii.qty = 10, ii.unit_price = 50
WHERE ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s ON s.id = ci.store_id WHERE ci.name = 'Social Media Post Design' AND s.name = 'DEXEL' ORDER BY ci.id LIMIT 1) p) AND ii.qty = 11 AND ii.unit_price = 45.45 AND i.amount = 500;

INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Gift Voucher & Coupon Design', 'Gift vouchers and discount coupons designed to the clients brand and offer (up to 10 designs), delivered print-ready and as digital PNGs.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Gift Voucher & Coupon Design' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Gift Voucher & Coupon Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Gift Voucher & Coupon Templates – 10 Designs' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 300 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Gift Voucher & Coupon Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Thank-You Cards & Package Inserts', 'Thank-you cards and order inserts designed to the clients brand and packaging (up to 10 designs), print-ready PDF and editable files.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Thank-You Cards & Package Inserts' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Thank-You Cards & Package Inserts' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Thank-You Cards & Package Inserts – 10 Designs' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 300 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Thank-You Cards & Package Inserts' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Invitation Design', 'Invitation designed for the clients event (wedding, opening or corporate), with print and digital versions.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Invitation Design' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Invitation Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Invitation Templates – Weddings & Events (5 Designs)' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 375 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Invitation Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Calendar Design', '12-month calendar designed with the clients branding and imagery, wall or desk format, print-ready PDF.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Calendar Design' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Calendar Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Calendar Template – 12 Months' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 375 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Calendar Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Flyer & Poster Design', 'Flyers and posters designed to the clients brand and content, print-ready at 300 dpi with bleed.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Flyer & Poster Design' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Flyer & Poster Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Flyer & Poster Templates – 10 Designs' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 450 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Flyer & Poster Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Sticker Design', 'Stickers designed to the clients brand and theme, laid out with die-cut lines; print-ready PDF and transparent PNGs.', (SELECT id FROM catalog_categories WHERE name = 'مطبوعات وتغليف' ORDER BY id LIMIT 1), NULL, 500 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Custom Sticker Design' AND store_id IS NULL);
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Sticker Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Sticker Pack – 20 Designs' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 375 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Sticker Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;
UPDATE invoice_items SET item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Sticker Design' AND store_id IS NULL ORDER BY id LIMIT 1) x)
WHERE item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Branded Sticker Set' AND store_id IS NULL ORDER BY id LIMIT 1) x) AND unit_price >= 500 AND (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Sticker Design' AND store_id IS NULL ORDER BY id LIMIT 1) x) IS NOT NULL;

UPDATE catalog_items SET description = 'Animated video content (intros, logo animations, reels or animated posts). Each unit is one video; length and complexity are set per order, from short animated stories to videos of 30 seconds or more. Exported in square, vertical and horizontal formats.'
WHERE name = 'Motion Graphics & Reels';

-- 5) restore apostrophes lost in earlier service descriptions (and in the custom services above)
UPDATE catalog_items SET description = REPLACE(description, 'platforms sizes', 'platform''s sizes') WHERE description LIKE '%platforms sizes%';
UPDATE catalog_items SET description = REPLACE(description, 'brands digital', 'brand''s digital') WHERE description LIKE '%brands digital%';
UPDATE catalog_items SET description = REPLACE(description, 'dos and donts', 'do''s and don''ts') WHERE description LIKE '%dos and donts%';
UPDATE catalog_items SET description = REPLACE(description, 'suppliers dieline', 'supplier''s dieline') WHERE description LIKE '%suppliers dieline%';
UPDATE catalog_items SET description = REPLACE(description, 'clients brand', 'client''s brand') WHERE description LIKE '%clients brand%';
UPDATE catalog_items SET description = REPLACE(description, 'clients event', 'client''s event') WHERE description LIKE '%clients event%';
