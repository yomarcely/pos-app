-- Insérer les taux de TVA standards français

-- Tenant 1 (Vape)
INSERT INTO tax_rates (tenant_id, name, rate, code, description, is_default)
SELECT
  'f831a590-f365-4302-8aaf-1a7ac06d357d',
  name,
  rate,
  code,
  description,
  is_default
FROM (VALUES
  ('TVA 20%', 20.00, 'T1', 'Taux normal', true),
  ('TVA 10%', 10.00, 'T2', 'Taux intermédiaire', false),
  ('TVA 5.5%', 5.50, 'T3', 'Taux réduit', false),
  ('TVA 2.1%', 2.10, 'T4', 'Taux super réduit', false),
  ('TVA 0%', 0.00, 'T0', 'Exonéré', false)
) AS v(name, rate, code, description, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rates
  WHERE tenant_id = 'f831a590-f365-4302-8aaf-1a7ac06d357d'
  AND code = v.code
);

-- Tenant 2 (Vêtements)
INSERT INTO tax_rates (tenant_id, name, rate, code, description, is_default)
SELECT
  '9da91f8f-7513-451c-8a07-9008fa697a88',
  name,
  rate,
  code,
  description,
  is_default
FROM (VALUES
  ('TVA 20%', 20.00, 'T1', 'Taux normal', true),
  ('TVA 10%', 10.00, 'T2', 'Taux intermédiaire', false),
  ('TVA 5.5%', 5.50, 'T3', 'Taux réduit', false),
  ('TVA 2.1%', 2.10, 'T4', 'Taux super réduit', false),
  ('TVA 0%', 0.00, 'T0', 'Exonéré', false)
) AS v(name, rate, code, description, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rates
  WHERE tenant_id = '9da91f8f-7513-451c-8a07-9008fa697a88'
  AND code = v.code
);
