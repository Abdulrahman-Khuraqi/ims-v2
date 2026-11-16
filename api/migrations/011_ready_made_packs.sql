-- Ready-made design packs (print-ready and editable assets) sold by both stores, as products in their own category.
-- Prices are starting suggestions and can be changed in Settings > Services & products.
INSERT INTO catalog_categories (name, color, sort) SELECT 'تصاميم جاهزة', '#0d9488', 18 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM catalog_categories WHERE name = 'تصاميم جاهزة');

INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Sticker Pack – 20 Designs', '20 ready-made sticker designs with die-cut lines, laid out on A4 sticker sheets. Print-ready PDF with cut path, plus individual transparent PNGs.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 150 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Sticker Pack – 20 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Sticker Pack – 50 Designs', '50 ready-made sticker designs across themes (quotes, icons, badges), laid out on A4 sticker sheets with die-cut lines. Print-ready PDF and transparent PNGs.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 300 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Sticker Pack – 50 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Branded Sticker Set', 'Your logo and brand colours prepared as round, square and die-cut stickers and seal labels in 3 sizes. Print-ready PDF with cut lines and transparent PNGs.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 200 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Branded Sticker Set' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Product Label & Tag Pack – 20 Designs', '20 editable product labels, hang tags and jar labels with space for name, ingredients and barcode. Print-ready PDF with bleed and editable source files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 180 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Product Label & Tag Pack – 20 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Thank-You Cards & Package Inserts – 10 Designs', '10 printable thank-you cards and order inserts for online stores, in A6 and square sizes. Print-ready PDF with bleed and editable files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 120 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Thank-You Cards & Package Inserts – 10 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Business Card Templates – 10 Designs', '10 editable business card designs (front and back) at 9 × 5 cm with bleed and CMYK colour. Print-ready PDF and editable source files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 120 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Business Card Templates – 10 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Flyer & Poster Templates – 10 Designs', '10 editable flyer and poster layouts in A4 and A3, ready to print at 300 dpi with bleed. Print-ready PDF and editable source files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 180 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Flyer & Poster Templates – 10 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Menu Templates – Restaurant & Café (5 Designs)', '5 editable menu designs in A4, A3 and tri-fold formats, plus a digital version for QR menus. Print-ready PDF and editable source files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 200 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Menu Templates – Restaurant & Café (5 Designs)' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Gift Voucher & Coupon Templates – 10 Designs', '10 editable gift vouchers and discount coupons with space for code and expiry date. Print-ready PDF and digital PNG versions.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 120 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Gift Voucher & Coupon Templates – 10 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Social Media Template Pack – 30 Templates', '30 editable post and story templates (Canva and PSD) on one consistent style, sized for Instagram, X and Snapchat.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 250 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Social Media Template Pack – 30 Templates' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Story Highlight Icons – 40 Icons', '40 story highlight cover icons in a consistent style, supplied in 3 colourways as PNG and editable files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 90 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Story Highlight Icons – 40 Icons' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Ramadan & Eid Greeting Pack – 20 Designs', '20 seasonal designs for Ramadan, Eid al-Fitr and Eid al-Adha, sized for social media and print (A5 cards). Editable with your logo.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 200 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Ramadan & Eid Greeting Pack – 20 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Saudi National Day Pack – 15 Designs', '15 National Day designs for social media posts, stories and print, editable with your logo and message.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 180 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Saudi National Day Pack – 15 Designs' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Invitation Templates – Weddings & Events (5 Designs)', '5 editable invitation designs for weddings, openings and corporate events, in print (A5) and digital versions.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 150 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Invitation Templates – Weddings & Events (5 Designs)' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Presentation Template – 30 Slides', '30-slide editable presentation template (PowerPoint and Keynote) with title, content, chart and team layouts, in 16:9.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 250 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Presentation Template – 30 Slides' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Icon Set – 100 Icons', '100 line icons in a consistent style for websites, apps and print, supplied as SVG, PNG and editable source files.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 150 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Icon Set – 100 Icons' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Mockup Pack – 15 Mockups', '15 high-resolution mockups (packaging, stationery, signage and devices) with smart-object layers for quick presentation of designs.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 200 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Mockup Pack – 15 Mockups' AND store_id IS NULL);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'product', 'Calendar Template – 12 Months', 'Editable 12-month calendar in wall and desk formats with your branding, print-ready PDF with bleed.', (SELECT id FROM catalog_categories WHERE name = 'تصاميم جاهزة' ORDER BY id LIMIT 1), NULL, 150 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Calendar Template – 12 Months' AND store_id IS NULL);
