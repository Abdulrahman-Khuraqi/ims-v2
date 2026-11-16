-- Optional website for each store, shown in Settings → Stores.
ALTER TABLE stores ADD COLUMN website VARCHAR(255) NULL AFTER color;

UPDATE stores SET website = 'https://dexelsa.com/' WHERE name = 'DEXEL' AND website IS NULL;
UPDATE stores SET website = 'https://artxel.co/' WHERE name = 'ARTXEL' AND website IS NULL;
