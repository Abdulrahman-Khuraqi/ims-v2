-- Replace the vague 'Custom Design Service' with specific services matched to how it was used (store and amount).
-- 1) new services  2) move its invoice lines (amounts unchanged)  3) archive it once nothing uses it.

INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Design Revision Round', 'One additional round of revisions on delivered designs.', (SELECT id FROM catalog_categories WHERE name = 'خدمات' ORDER BY id LIMIT 1), s.id, 100 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Design Revision Round' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Design Adaptation & Resizing', 'Existing designs adapted to new sizes, formats or platforms, delivered as export-ready files.', (SELECT id FROM catalog_categories WHERE name = 'خدمات' ORDER BY id LIMIT 1), s.id, 500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Design Adaptation & Resizing' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Illustration', 'Bespoke illustration created for the brands digital or print use, delivered in high-resolution formats.', (SELECT id FROM catalog_categories WHERE name = 'خدمات' ORDER BY id LIMIT 1), s.id, 1000 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Custom Illustration' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Custom Illustration', 'Bespoke illustration created for the brands digital or print use, delivered in high-resolution formats.', (SELECT id FROM catalog_categories WHERE name = 'خدمات' ORDER BY id LIMIT 1), s.id, 1000 FROM stores s
WHERE s.name = 'ARTXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Custom Illustration' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Creative Direction & Concept Development', 'Moodboard, visual direction and design concepts for a new project, prepared for production.', (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 1500 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Creative Direction & Concept Development' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand Identity & Social Media Launch', 'Brand Identity System with 12 launch social media designs, profile covers and highlight icons, ready for go-live.', (SELECT id FROM catalog_categories WHERE name = 'باقات' ORDER BY id LIMIT 1), s.id, 4000 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand Identity & Social Media Launch' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Website & App UI/UX Design – Up to 8 Pages', 'User journeys, wireframes and high-fidelity UI for up to 8 pages or screens on desktop and mobile, with an interactive prototype and developer-ready Figma files.', (SELECT id FROM catalog_categories WHERE name = 'مواقع وتطبيقات' ORDER BY id LIMIT 1), s.id, 5000 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Website & App UI/UX Design – Up to 8 Pages' AND ci.store_id = s.id);
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand Identity & Website Design', 'Brand Identity System plus website UI/UX design for up to 5 pages on desktop and mobile, with an interactive prototype.', (SELECT id FROM catalog_categories WHERE name = 'باقات' ORDER BY id LIMIT 1), s.id, 6000 FROM stores s
WHERE s.name = 'DEXEL' AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand Identity & Website Design' AND ci.store_id = s.id);

UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Revision Round' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 100
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Revision Round' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Revision Round' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 2, ii.unit_price = ROUND(i.amount / 2, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 200
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Revision Round' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Adaptation & Resizing' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 500
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Design Adaptation & Resizing' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Custom Illustration' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 1000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Custom Illustration' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Custom Illustration' AND s2.name = 'ARTXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'ARTXEL' AND i.amount = 1000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Custom Illustration' AND s2.name = 'ARTXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Creative Direction & Concept Development' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 1500
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Creative Direction & Concept Development' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity Essentials' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 2000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity Essentials' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity System' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 2500
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity System' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Exhibition Booth Design' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 3000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Exhibition Booth Design' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity & Social Media Launch' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 4000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity & Social Media Launch' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Website & App UI/UX Design – Up to 8 Pages' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 5000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Website & App UI/UX Design – Up to 8 Pages' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;
UPDATE invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN stores s ON s.id = i.store_id
SET ii.item_id = (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity & Website Design' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t), ii.qty = 1, ii.unit_price = ROUND(i.amount / 1, 2)
WHERE ii.item_id = (SELECT id FROM (SELECT id FROM catalog_items WHERE name = 'Custom Design Service' AND store_id IS NULL ORDER BY id LIMIT 1) c) AND s.name = 'DEXEL' AND i.amount = 6000
  AND (SELECT id FROM (SELECT ci.id FROM catalog_items ci JOIN stores s2 ON s2.id = ci.store_id WHERE ci.name = 'Brand Identity & Website Design' AND s2.name = 'DEXEL' ORDER BY ci.id LIMIT 1) t) IS NOT NULL;

UPDATE catalog_items SET is_active = 0
WHERE name = 'Custom Design Service' AND store_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.item_id = catalog_items.id);
