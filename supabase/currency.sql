-- Update transactions table for multi-currency
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency_code CHAR(3) NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS amount_base DECIMAL(10,2) NOT NULL DEFAULT 0;