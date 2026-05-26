# Runbook — Backup PostgreSQL & restauration (C3)

> Cibles : DB Postgres hébergée chez Supabase, dumps chiffrés GPG, stockage Cloudflare R2, cron quotidien GitHub Actions.
> Workflow : [.github/workflows/backup.yml](../../.github/workflows/backup.yml). Script : [scripts/backup-database.sh](../../scripts/backup-database.sh).

---

## 1. Setup initial (manuel, à faire une fois)

### 1.1 Cloudflare R2

1. Créer un bucket R2 : ex `pos-app-backups`.
2. Générer un token R2 avec accès `Object Read & Write` sur ce bucket uniquement.
3. Récupérer :
   - `Access Key ID`
   - `Secret Access Key`
   - `Endpoint` au format `https://<account_id>.r2.cloudflarestorage.com`
4. **Lifecycle rule** : configurer une règle "Delete after 2190 days" (6 ans) pour expiration automatique. Cela couvre la rétention NF525 sans gérer manuellement les anciens dumps.

### 1.2 Keypair GPG

Sur ta machine locale (jamais sur GitHub) :

```bash
gpg --full-generate-key
# Type : RSA et RSA (par défaut)
# Taille : 4096
# Expiration : 0 (jamais — clé d'archive)
# Nom : POS-App Backup
# Email : backup@<ton-domaine>
# Passphrase : forte, stockée dans 1Password
```

Exporter la **clé publique** (sera mise dans GitHub) :

```bash
gpg --armor --export backup@<ton-domaine> > pos-app-backup-public.asc
```

Exporter la **clé privée** (à NE JAMAIS mettre dans GitHub) :

```bash
gpg --armor --export-secret-keys backup@<ton-domaine> > pos-app-backup-private.asc
```

Stocker `pos-app-backup-private.asc` + passphrase dans **1Password** (ou équivalent coffre-fort) et idéalement aussi imprimé sur papier dans un coffre. Si tu perds cette clé, **tous les backups sont inutilisables**.

### 1.3 User PostgreSQL read-only (Supabase)

Dans le SQL Editor Supabase, créer un user dédié au backup :

```sql
CREATE ROLE backup_readonly WITH LOGIN PASSWORD '<mdp fort>';
GRANT CONNECT ON DATABASE postgres TO backup_readonly;
GRANT USAGE ON SCHEMA public TO backup_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_readonly;
```

Construire l'URL de connexion via le **Session Pooler** (port 5432, IPv4) pour garantir la compatibilité GH Actions :

```
postgresql://backup_readonly:<mdp>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

> Note : ne pas utiliser le Direct Connection (IPv6 only sur le plan Free) ni le Transaction Pooler (port 6543, mode transaction = incompatible `pg_dump`).

### 1.4 Secrets GitHub

Settings → Secrets and variables → Actions → New repository secret :

| Nom | Valeur |
|---|---|
| `BACKUP_DATABASE_URL` | URL session pooler du user `backup_readonly` (étape 1.3) |
| `BACKUP_GPG_PUBLIC_KEY` | Contenu de `pos-app-backup-public.asc` (clé publique entière, ASCII-armored) |
| `R2_ACCESS_KEY_ID` | Access Key R2 |
| `R2_SECRET_ACCESS_KEY` | Secret R2 |
| `R2_BUCKET` | ex `pos-app-backups` |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |

### 1.5 Test du workflow

1. Onglet Actions → "Backup PostgreSQL" → "Run workflow" (branche `main`).
2. Vérifier que le run termine en vert.
3. Vérifier la présence du fichier dans R2 : `<YYYY-MM-DD>/pos-app-<timestamp>.pgdump.gpg`.
4. **Tester la restauration en local** (procédure §3) au moins une fois pour valider la chaîne complète. Sans test de restauration, un backup n'est qu'une supposition.

---

## 2. Cadence

- **Cron** : 03:00 UTC tous les jours (`0 3 * * *`).
- **Trigger manuel** : `workflow_dispatch` disponible (utile en cas de migration importante).
- **Notification d'échec** : GitHub envoie un email à l'owner du repo sur failure. Aucune intégration Sentry directe (le workflow tourne hors app — pas pertinent).

---

## 3. Procédure de restauration

> À tester **au moins une fois après le setup** et ensuite **trimestriellement** sur un Postgres jetable (local ou env de dev).

### 3.1 Récupérer le dump

Depuis l'interface R2 Cloudflare, télécharger le fichier `.pgdump.gpg` ciblé. Ou via aws CLI :

```bash
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto

aws s3 cp s3://pos-app-backups/2026-05-16/pos-app-20260516T030000Z.pgdump.gpg . \
  --endpoint-url "$R2_ENDPOINT"
```

### 3.2 Déchiffrer

```bash
# Importer la clé privée dans le keyring local (une seule fois)
gpg --import pos-app-backup-private.asc

# Déchiffrer (passphrase demandée)
gpg --output dump.pgdump --decrypt pos-app-20260516T030000Z.pgdump.gpg
```

### 3.3 Restaurer sur un Postgres cible

⚠️ **Ne JAMAIS restaurer directement sur la base prod sans backup préalable de l'état actuel.** Toujours passer par une base intermédiaire.

```bash
# Créer une base vide cible
createdb -h localhost -U postgres pos_app_restored

# Restaurer
pg_restore \
  --dbname=pos_app_restored \
  --no-owner \
  --no-privileges \
  --verbose \
  dump.pgdump
```

Vérifier :
- Tables présentes : `\dt` dans `psql`
- Nombre de ventes : `SELECT COUNT(*) FROM sales;`
- Dernière clôture : `SELECT MAX(closure_date) FROM closures;`
- Hash NF525 du dernier ticket : `SELECT id, ticket_hash FROM sales ORDER BY id DESC LIMIT 1;` (doit matcher l'archive NF525 légale)

### 3.4 Bascule prod (si restauration réelle)

Hors scope de ce runbook — dépend de la nature de l'incident. Étapes typiques :

1. Mettre l'app en maintenance (page statique).
2. Snapshot manuel de l'état actuel (`pg_dump` complet) avant toute action.
3. Restaurer sur une base de remplacement.
4. Repointer `DATABASE_URL` vers la nouvelle base.
5. Redémarrer l'app, vérifier le smoke test.
6. **Auditer l'intégrité NF525** : la chaîne de hash doit être continue. Tout trou = à signaler aux autorités.

---

## 4. Limites connues

- **Plan Supabase Free** : pas de Point-in-Time Recovery. Le seul filet en cas de corruption silencieuse est ce backup quotidien — perte max théorique = 24h de données.
- **GitHub Actions non garanti** : si GH est en panne au moment du cron, le backup du jour est skippé. Pas de retry automatique. Surveiller les emails de failure.
- **pg_dump = snapshot logique** : la cohérence transactionnelle est garantie au démarrage du dump. Aucune mise en pause de l'app nécessaire.
- **Clé privée GPG perdue = données perdues**. Doublon physique (papier dans coffre) recommandé.
- **Version pg_dump** : doit matcher la version serveur Supabase. Le workflow installe `postgresql-client-15`. À mettre à jour si Supabase upgrade.

---

## 5. Distinction archivage NF525 vs backup DB

Ne pas confondre :

| Sujet | Quoi | Périodicité | Fichiers |
|---|---|---|---|
| **Archivage NF525** (obligation légale) | Hash chaînés signés des ventes | Périodique (clôture journalière + archive grand livre) | `server/utils/nf525.ts`, archives signées dans `ARCHIVE_PATH` |
| **Backup DB** (disaster recovery) | Snapshot complet de la base | Quotidien | R2 bucket `pos-app-backups` |

Le backup DB **complète** l'archivage NF525 ; il ne le remplace pas. En cas de contrôle fiscal, ce sont les archives NF525 signées qui font foi, pas le dump Postgres.
