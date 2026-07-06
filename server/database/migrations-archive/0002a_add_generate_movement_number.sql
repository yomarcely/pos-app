-- Génère un numéro de mouvement unique du type PREFIX-000001
-- Si vous souhaitez un préfixe par tenant ou par type, adaptez la concaténation ci-dessous.

-- Séquence globale pour les numéros de mouvement
CREATE SEQUENCE IF NOT EXISTS movement_number_seq START 1;

-- Fonction de génération
CREATE OR REPLACE FUNCTION generate_movement_number(movement_type varchar)
RETURNS varchar AS $$
DECLARE
    next_num bigint;
    prefix varchar := COALESCE(upper(movement_type), 'MVT');
BEGIN
    next_num := nextval('movement_number_seq');
    RETURN prefix || '-' || lpad(next_num::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

