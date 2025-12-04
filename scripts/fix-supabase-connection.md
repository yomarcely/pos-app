# Fix Connexion Supabase - Utiliser le Connection Pooler

## 🔍 Problème Identifié

Le DNS ne résout pas `db.sbsdlmwtlvejfnszxrcp.supabase.co` car **Supabase nécessite le Connection Pooler** pour les connexions externes, pas la connexion directe.

```
nslookup db.sbsdlmwtlvejfnszxrcp.supabase.co
*** Can't find db.sbsdlmwtlvejfnszxrcp.supabase.co: No answer
```

## ✅ Solution : Utiliser le Connection Pooler

### Étape 1 : Récupérer l'URL du Connection Pooler

1. Allez sur Supabase Dashboard :
   https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/settings/database

2. Trouvez la section **"Connection string"**

3. Vous verrez **2 types de connexions** :

   **❌ Direct Connection** (ne fonctionne pas en externe) :
   ```
   postgresql://postgres:[PASSWORD]@db.sbsdlmwtlvejfnszxrcp.supabase.co:5432/postgres
   ```

   **✅ Connection Pooler** (à utiliser) :
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

4. Cliquez sur **"Connection pooling"** ou **"Transaction mode"**

5. Copiez l'URL complète (format : `postgresql://postgres.PROJECT:[PASSWORD]@REGION.pooler.supabase.com:6543/postgres`)

### Étape 2 : Mettre à jour votre .env

Remplacez votre DATABASE_URL actuelle par l'URL du pooler :

**Avant** :
```bash
DATABASE_URL=postgresql://postgres:5SY70Zhuq41n5CqJ@db.sbsdlmwtlvejfnszxrcp.supabase.co:5432/postgres?sslmode=require
```

**Après** (utilisez l'URL que vous avez copiée) :
```bash
DATABASE_URL=postgresql://postgres.sbsdlmwtlvejfnszxrcp:5SY70Zhuq41n5CqJ@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Points importants** :
- Port change de **5432** → **6543**
- Host change de `db.xxx` → `aws-0-REGION.pooler`
- Username inclut le project ref : `postgres.sbsdlmwtlvejfnszxrcp`

### Étape 3 : Mettre à jour TOUS vos fichiers .env

```bash
# .env
DATABASE_URL=postgresql://postgres.sbsdlmwtlvejfnszxrcp:[PASSWORD]@[POOLER-HOST]:6543/postgres?sslmode=require

# .env.development
DATABASE_URL=postgresql://postgres.sbsdlmwtlvejfnszxrcp:[PASSWORD]@[POOLER-HOST]:6543/postgres?sslmode=require

# .env.staging (si vous l'utilisez)
DATABASE_URL=postgresql://postgres.sbsdlmwtlvejfnszxrcp:[PASSWORD]@[POOLER-HOST]:6543/postgres?sslmode=require
```

### Étape 4 : Tester la connexion

```bash
# Tester le DNS du pooler
nslookup aws-0-eu-central-1.pooler.supabase.com

# Devrait retourner une IP valide
```

### Étape 5 : Appliquer les migrations

```bash
# Maintenant ça devrait fonctionner !
pnpm db:migrate

# Ou push le schéma
pnpm db:push

# Vérifier avec Drizzle Studio
pnpm db:studio
```

## 📋 Format de l'URL du Pooler

Le format typique est :
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

Où :
- `[PROJECT-REF]` = `sbsdlmwtlvejfnszxrcp`
- `[PASSWORD]` = `5SY70Zhuq41n5CqJ`
- `[REGION]` = Dépend de votre région (ex: `eu-central-1`, `us-east-1`, etc.)

## 🔍 Comment trouver votre région ?

Dans le Dashboard Supabase, l'URL du pooler affiche la région. Exemples :
- EU Central : `aws-0-eu-central-1.pooler.supabase.com`
- US East : `aws-0-us-east-1.pooler.supabase.com`
- AP Southeast : `aws-0-ap-southeast-1.pooler.supabase.com`

## ⚙️ Modes de connexion Supabase

Supabase propose 3 modes de pooling :

1. **Transaction mode** (recommandé pour Drizzle) : Port 6543
   - Une transaction = une connexion
   - Idéal pour les migrations

2. **Session mode** : Port 5432
   - Une session = une connexion
   - Comme une connexion PostgreSQL normale

3. **Direct connection** : Port 5432
   - ❌ Ne fonctionne pas en externe
   - Réservé aux connexions internes Supabase

Pour Drizzle, utilisez **Transaction mode** (port 6543).

## 🧪 Test Rapide

Une fois l'URL mise à jour :

```bash
# Test 1 : Vérifier que l'URL est chargée
node -e "require('dotenv').config(); console.log('URL:', process.env.DATABASE_URL)"

# Test 2 : Test de connexion simple
node -e "require('dotenv').config(); const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => { console.log('✅ Connexion OK'); client.end(); }).catch(e => console.error('❌', e.message))"

# Test 3 : Push le schéma
pnpm db:push
```

## 📚 Référence

- [Supabase Database Settings](https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/settings/database)
- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Drizzle with Supabase](https://orm.drizzle.team/docs/get-started-postgresql#supabase)

---

**Action immédiate** : Allez récupérer votre URL de pooler sur le Dashboard Supabase !
