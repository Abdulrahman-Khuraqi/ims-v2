-- Payments removed as tests (e.g. 1 or 10 SAR checks of the payment page). Their gateway ids are kept here
-- so importing the same payments file again does not bring them back.
CREATE TABLE IF NOT EXISTS ignored_transactions (
  transaction_id VARCHAR(64) NOT NULL,
  reason VARCHAR(40) NOT NULL DEFAULT 'test',
  amount DECIMAL(12,2) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
