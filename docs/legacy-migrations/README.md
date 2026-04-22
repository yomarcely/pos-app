# Legacy Migrations

Ces scripts ont été utilisés avant la mise en place de Drizzle comme
gestionnaire de migrations officiel. Ils sont conservés à titre historique.

⚠️ NE PAS EXÉCUTER — leur contenu est couvert par les migrations
Drizzle dans `server/database/migrations/`.

Contexte : voir docs/audit/05-migrations.md

## Migrations SQL orphelines archivées

- `0007_sync_multi_establishment.sql`
- `0010_add_establishment_tracking.sql`

Raison : fichiers SQL présents dans `server/database/migrations/` mais **absents
de `meta/_journal.json`** (doublons d'indices avec `0007_icy_madripoor` et
`0010_striped_ares`, les seuls trackés par Drizzle). Non exécutés jusqu'ici.

Risque écarté : un `drizzle-kit migrate` contre une DB au meta divergent aurait
pu les ré-exécuter fortuitement. Archivés ici pour les sortir du chemin de
scan et conserver leur contenu pour référence.
