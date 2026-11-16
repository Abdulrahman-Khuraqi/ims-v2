-- Replace the starter stores from 001 (ARVO, X Run Studio, anas) with DEXEL and ARTXEL.
-- Only the untouched seed rows are removed, and only if no invoice uses them.
-- Their terminal links, catalog items and user restrictions go with them (ON DELETE CASCADE).

DELETE FROM stores
WHERE id IN (1, 2, 3)
  AND name IN ('ARVO', 'X Run Studio', 'anas')
  AND NOT EXISTS (SELECT 1 FROM invoices WHERE invoices.store_id = stores.id);

-- dexelsa.com
INSERT INTO stores (name, color, sort)
SELECT 'DEXEL', '#7c3aed', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'DEXEL');

-- artxel.co
INSERT INTO stores (name, color, sort)
SELECT 'ARTXEL', '#0ea5e9', 2 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'ARTXEL');
