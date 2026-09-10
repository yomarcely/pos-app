# Audits archivés (mars–avril 2026)

Rapports d'audit **terminés**. Leurs conclusions ont toutes été exécutées via le
[plan de corrections](../11-plan-corrections.md) (P1.1 → P4.4, tous mergés le 2026-06-28).

⚠️ **Valeur historique uniquement.** Ces documents décrivent l'état du code au moment
de l'audit, pas l'état actuel. Ne pas s'y fier pour agir — se référer à
[CLAUDE.md](../../../CLAUDE.md) et à l'[audit d'architecture de juillet 2026](../../architecture/2026-07-audit-architecture-cible.md).

Ils sont conservés parce qu'ils tracent le *raisonnement* derrière les décisions prises
(utile si un organisme certificateur, ou toi dans six mois, remonte le fil d'une décision).

| Audit | Sujet | Suite donnée |
|---|---|---|
| [01](01-cartographie.md) | Cartographie du dépôt | Point de départ des audits suivants |
| [02](02-typescript-strict.md) | TypeScript strict | Purge des `any` (P4.1) |
| [03](03-supabase-fetch.md) | Frontière Supabase / $fetch | Invariants 2 et 3 de CLAUDE.md |
| [04](04-dead-code.md) | Code mort | Suppressions (P4.2) |
| [05](05-migrations.md) | Migrations Drizzle | Doublons résolus, puis baseline squash (2026-07-06) |
| [06](06-composables-a-extraire.md) | Pages monolithiques | 16 composables extraits |
| [07](07-calculs-financiers.md) | Calculs financiers | Centimes entiers, invariant 6 de CLAUDE.md |
| [08](08-nf525-tests.md) | Couverture de tests NF525 | 42 tests unitaires + note sur les ventes antérieures au fix P1.2 |
| [09](09-stores-pinia.md) | Stores Pinia | R1–R8 appliqués, singletons → Pinia (P4.4) |
| [10](10-securite.md) | Sécurité | Validation `x-tenant-id` (P1.1), RBAC (P3.4) |
