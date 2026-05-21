-- Per-customer "extra work" villkor template, plus a per-order snapshot copy
-- and a global fallback. On create the cascade is: input → kund → global → ''.
-- ordrar.villkor stores the snapshot so editing the customer template later
-- doesn't rewrite history on already-issued/signed orders.

ALTER TABLE kunder
  ADD COLUMN IF NOT EXISTS order_std_villkor TEXT NOT NULL DEFAULT '';

ALTER TABLE ordrar
  ADD COLUMN IF NOT EXISTS villkor TEXT;

ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS order_std_villkor TEXT NOT NULL DEFAULT '';
