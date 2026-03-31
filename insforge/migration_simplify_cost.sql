-- Migration: Replace cost_batches JSONB with simple cost_price FLOAT
-- This simplifies the FIFO system to a flat price model

-- Add new cost_price column (default 0 for safe migration of existing products)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS cost_price FLOAT DEFAULT 0;

-- Remove the old JSONB column (safe to drop now)
ALTER TABLE products 
  DROP COLUMN IF EXISTS cost_batches;

-- Update the timestamp so existing rows get updated_at refreshed
UPDATE products SET updated_at = NOW() WHERE TRUE;
