-- ==========================================
-- POLITIQUES RLS (Row Level Security)
-- ==========================================
--
-- Ces politiques assurent que chaque utilisateur ne peut accéder
-- qu'à ses propres données, même en contournant l'API
--
-- IMPORTANT: Ces politiques utilisent auth.uid() qui retourne l'UUID
-- de l'utilisateur connecté via Supabase Auth
--
-- NOTE: tenant_id est VARCHAR, donc on cast auth.uid()::TEXT
-- ==========================================

-- ==========================================
-- 1. ACTIVER RLS SUR TOUTES LES TABLES
-- ==========================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. PRODUCTS - Politiques RLS
-- ==========================================

-- SELECT: Un utilisateur ne peut voir que ses propres produits
CREATE POLICY "Users can view their own products"
ON products FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- INSERT: Un utilisateur ne peut créer des produits que pour lui-même
CREATE POLICY "Users can create their own products"
ON products FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- UPDATE: Un utilisateur ne peut modifier que ses propres produits
CREATE POLICY "Users can update their own products"
ON products FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- DELETE: Un utilisateur ne peut supprimer que ses propres produits
CREATE POLICY "Users can delete their own products"
ON products FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 3. CATEGORIES - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own categories"
ON categories FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own categories"
ON categories FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own categories"
ON categories FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own categories"
ON categories FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 4. CUSTOMERS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own customers"
ON customers FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own customers"
ON customers FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own customers"
ON customers FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 5. SUPPLIERS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own suppliers"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own suppliers"
ON suppliers FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own suppliers"
ON suppliers FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 6. BRANDS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own brands"
ON brands FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own brands"
ON brands FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own brands"
ON brands FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own brands"
ON brands FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 7. VARIATION GROUPS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own variation groups"
ON variation_groups FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own variation groups"
ON variation_groups FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own variation groups"
ON variation_groups FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own variation groups"
ON variation_groups FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 8. VARIATIONS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own variations"
ON variations FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own variations"
ON variations FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own variations"
ON variations FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own variations"
ON variations FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 9. SALES - Politiques RLS (Critiques NF525)
-- ==========================================

CREATE POLICY "Users can view their own sales"
ON sales FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sales"
ON sales FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sales"
ON sales FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- Note: Les ventes ne devraient jamais être supprimées (conformité NF525)
-- Mais on ajoute la politique au cas où
CREATE POLICY "Users can delete their own sales"
ON sales FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 10. SALE_ITEMS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own sale items"
ON sale_items FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sale items"
ON sale_items FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sale items"
ON sale_items FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own sale items"
ON sale_items FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 11. STOCK_MOVEMENTS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own stock movements"
ON stock_movements FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own stock movements"
ON stock_movements FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own stock movements"
ON stock_movements FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own stock movements"
ON stock_movements FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 12. CLOSURES - Politiques RLS (Critiques NF525)
-- ==========================================

CREATE POLICY "Users can view their own closures"
ON closures FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own closures"
ON closures FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- Les clôtures ne doivent jamais être modifiées ou supprimées (NF525)
-- Mais on ajoute les politiques pour la cohérence
CREATE POLICY "Users can update their own closures"
ON closures FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own closures"
ON closures FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 13. AUDIT_LOGS - Politiques RLS (RGPD)
-- ==========================================

CREATE POLICY "Users can view their own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- Les logs d'audit ne doivent jamais être modifiés ou supprimés
-- On autorise uniquement SELECT et INSERT

-- ==========================================
-- 14. SELLERS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own sellers"
ON sellers FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sellers"
ON sellers FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sellers"
ON sellers FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own sellers"
ON sellers FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 15. ESTABLISHMENTS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own establishments"
ON establishments FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own establishments"
ON establishments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own establishments"
ON establishments FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own establishments"
ON establishments FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 15b. REGISTERS (CAISSES) - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own registers"
ON registers FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own registers"
ON registers FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own registers"
ON registers FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own registers"
ON registers FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 16. MOVEMENTS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own movements"
ON movements FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own movements"
ON movements FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own movements"
ON movements FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own movements"
ON movements FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 17. ARCHIVES - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own archives"
ON archives FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own archives"
ON archives FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- Les archives ne devraient normalement pas être modifiées ou supprimées
-- Mais on ajoute les politiques pour la cohérence
CREATE POLICY "Users can update their own archives"
ON archives FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own archives"
ON archives FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 18. SELLER_ESTABLISHMENTS - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own seller establishments"
ON seller_establishments FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own seller establishments"
ON seller_establishments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own seller establishments"
ON seller_establishments FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own seller establishments"
ON seller_establishments FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 19. TAX_RATES - Politiques RLS
-- ==========================================

CREATE POLICY "Users can view their own tax rates"
ON tax_rates FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own tax rates"
ON tax_rates FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own tax rates"
ON tax_rates FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own tax rates"
ON tax_rates FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 20. SYNC_GROUPS - Politiques RLS (Synchronisation)
-- ==========================================

ALTER TABLE sync_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync groups"
ON sync_groups FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sync groups"
ON sync_groups FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sync groups"
ON sync_groups FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own sync groups"
ON sync_groups FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 21. SYNC_GROUP_ESTABLISHMENTS - Politiques RLS
-- ==========================================

ALTER TABLE sync_group_establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync group establishments"
ON sync_group_establishments FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sync group establishments"
ON sync_group_establishments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sync group establishments"
ON sync_group_establishments FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own sync group establishments"
ON sync_group_establishments FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 22. SYNC_RULES - Politiques RLS
-- ==========================================

ALTER TABLE sync_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync rules"
ON sync_rules FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sync rules"
ON sync_rules FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own sync rules"
ON sync_rules FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own sync rules"
ON sync_rules FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 23. PRODUCT_STOCKS - Politiques RLS
-- ==========================================

ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own product stocks"
ON product_stocks FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own product stocks"
ON product_stocks FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own product stocks"
ON product_stocks FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own product stocks"
ON product_stocks FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 24. PRODUCT_ESTABLISHMENTS - Politiques RLS
-- ==========================================

ALTER TABLE product_establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own product establishments"
ON product_establishments FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own product establishments"
ON product_establishments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own product establishments"
ON product_establishments FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own product establishments"
ON product_establishments FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 25. CUSTOMER_ESTABLISHMENTS - Politiques RLS
-- ==========================================

ALTER TABLE customer_establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer establishments"
ON customer_establishments FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own customer establishments"
ON customer_establishments FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can update their own customer establishments"
ON customer_establishments FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid()::TEXT)
WITH CHECK (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can delete their own customer establishments"
ON customer_establishments FOR DELETE
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- 26. SYNC_LOGS - Politiques RLS (Audit - READ ONLY)
-- ==========================================

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
ON sync_logs FOR SELECT
TO authenticated
USING (tenant_id = auth.uid()::TEXT);

CREATE POLICY "Users can create their own sync logs"
ON sync_logs FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid()::TEXT);

-- Note: Les logs de synchronisation ne doivent jamais être modifiés ou supprimés
-- (conformité NF525 - traçabilité). On autorise uniquement SELECT et INSERT.

-- ==========================================
-- 27. VÉRIFICATION DES POLITIQUES
-- ==========================================

-- Pour vérifier que les politiques sont bien appliquées :
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
