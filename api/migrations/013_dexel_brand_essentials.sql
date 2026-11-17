-- DEXEL mid-tier branding at 2,000 SAR, between "Logo Design & Variations" (1,500) and "Brand Identity System" (2,500).
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Brand Identity Essentials',
       'Core brand identity: logo suite (primary, secondary and icon mark) refined from 2 initial concepts, a colour palette with HEX, RGB and CMYK codes, a typography pairing, a short brand guide (logo usage, colours and fonts, PDF) and a business card design. Delivered in SVG, PNG and PDF. 2 revision rounds. Supporting patterns, full stationery and digital applications are part of the Brand Identity System.',
       (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), s.id, 2000
FROM stores s
WHERE s.name = 'DEXEL'
  AND NOT EXISTS (SELECT 1 FROM catalog_items ci WHERE ci.name = 'Brand Identity Essentials' AND ci.store_id = s.id);
