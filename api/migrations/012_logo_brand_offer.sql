-- Entry-level logo & brand offer at 500 SAR for both stores: a lighter scope than "Logo Design" (1,500 SAR).
INSERT INTO catalog_items (kind, name, description, category_id, store_id, default_price)
SELECT 'service', 'Logo & Brand Starter – Special Offer',
       'Special offer: one logo concept refined into a final logo with 1 revision round, plus a 3-colour palette and a font recommendation. Delivered in colour and mono versions as high-resolution PNG (transparent background) and PDF. Editable source files, extra concepts, brand guidelines and stationery are not included.',
       (SELECT id FROM catalog_categories WHERE name = 'هوية بصرية' ORDER BY id LIMIT 1), NULL, 500
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE name = 'Logo & Brand Starter – Special Offer' AND store_id IS NULL);
