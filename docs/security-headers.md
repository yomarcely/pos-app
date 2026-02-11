# Headers de Sécurité HTTP - Configuration

Ce document explique la configuration des headers de sécurité HTTP implémentés dans l'application POS pour protéger contre les attaques web courantes.

## 📋 Vue d'ensemble

**Fichier de configuration** : `nuxt.config.ts`

Les headers de sécurité sont configurés via `nitro.routeRules` et s'appliquent automatiquement à toutes les routes de l'application.

---

## 🛡️ Headers Implémentés

### 1. Content-Security-Policy (CSP)

**Protection contre** : XSS (Cross-Site Scripting), injection de code malveillant

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
```

#### Directives Configurées

| Directive | Valeur | Explication |
|-----------|--------|-------------|
| `default-src` | `'self'` | Par défaut, autoriser uniquement les ressources du même domaine |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | Scripts du domaine + inline (requis pour Vue/Nuxt) |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Styles du domaine + Google Fonts |
| `font-src` | `'self' https://fonts.gstatic.com data:` | Polices du domaine + Google Fonts |
| `img-src` | `'self' data: https: blob:` | Images du domaine + data URIs + HTTPS |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co` | API calls vers Supabase |
| `frame-ancestors` | `'none'` | Interdit l'embedding dans des frames |
| `base-uri` | `'self'` | Restreint les URLs de base |
| `form-action` | `'self'` | Formulaires soumis uniquement au même domaine |

#### ⚠️ Notes pour Production

En production, vous devriez **supprimer** `'unsafe-inline'` et `'unsafe-eval'` :

```typescript
// Production CSP (plus strict)
"script-src 'self'",
"style-src 'self' https://fonts.googleapis.com",
```

Puis utiliser :
- Des hashes ou nonces pour les scripts inline
- Pré-compilation des templates Vue

---

### 2. X-Frame-Options

**Protection contre** : Clickjacking

```
X-Frame-Options: DENY
```

Empêche complètement l'application d'être affichée dans une iframe, même sur votre propre domaine.

**Valeurs possibles** :
- `DENY` : Jamais dans une iframe (recommandé)
- `SAMEORIGIN` : Iframe uniquement sur le même domaine
- `ALLOW-FROM uri` : (obsolète, utilisez CSP `frame-ancestors` à la place)

---

### 3. X-Content-Type-Options

**Protection contre** : MIME sniffing attacks

```
X-Content-Type-Options: nosniff
```

Force le navigateur à respecter le `Content-Type` déclaré et empêche l'interprétation automatique du type de fichier.

**Pourquoi c'est important** :
Sans cet header, un fichier `.txt` malveillant pourrait être interprété comme JavaScript et exécuté.

---

### 4. X-XSS-Protection

**Protection contre** : XSS (Cross-Site Scripting) - navigateurs anciens

```
X-XSS-Protection: 1; mode=block
```

Active le filtre XSS intégré des navigateurs anciens (obsolète dans les navigateurs modernes qui utilisent CSP).

**Valeurs** :
- `0` : Désactive la protection
- `1` : Active la protection (supprime les parties dangereuses)
- `1; mode=block` : Active et bloque complètement le chargement de la page

---

### 5. Referrer-Policy

**Protection contre** : Fuite d'informations sensibles dans les URLs

```
Referrer-Policy: strict-origin-when-cross-origin
```

Contrôle quelles informations de référence (URL d'origine) sont envoyées lors des navigations.

**Comportement** :
- **Même origine** : Envoie l'URL complète
- **Cross-origin HTTPS→HTTPS** : Envoie uniquement l'origine (domaine)
- **Cross-origin HTTPS→HTTP** : N'envoie rien (downgrade)

**Autres valeurs possibles** :
- `no-referrer` : Jamais de referrer (peut casser certains sites)
- `no-referrer-when-downgrade` : Défaut des navigateurs
- `origin` : Toujours juste l'origine
- `same-origin` : Referrer uniquement pour la même origine
- `strict-origin` : Origine sauf en cas de downgrade

---

### 6. Permissions-Policy

**Protection contre** : Utilisation non autorisée d'APIs sensibles

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

Désactive explicitement les APIs dangereuses ou non nécessaires.

**APIs Désactivées** :
- `camera=()` : Caméra
- `microphone=()` : Microphone
- `geolocation=()` : Géolocalisation
- `interest-cohort=()` : FLoC de Google (tracking)

**Autres APIs désactivables** :
```
payment=(), usb=(), magnetometer=(), gyroscope=()
```

---

### 7. Strict-Transport-Security (HSTS)

**Protection contre** : Attaques Man-in-the-Middle, downgrade HTTPS→HTTP

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**⚠️ IMPORTANT** : Activé **uniquement en production** (avec HTTPS)

#### Directives

| Directive | Valeur | Explication |
|-----------|--------|-------------|
| `max-age` | `31536000` | Durée de validité : 1 an (en secondes) |
| `includeSubDomains` | - | S'applique aussi aux sous-domaines |
| `preload` | - | Eligible pour la liste de préchargement HSTS des navigateurs |

#### Activation Conditionnelle

```typescript
...(process.env.NODE_ENV === 'production' ? {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
} : {})
```

**Pourquoi conditionnel** :
- En développement : Vous utilisez `http://localhost`
- En production : Vous **DEVEZ** utiliser HTTPS

#### Préchargement HSTS

Pour ajouter votre domaine à la liste HSTS preload :
1. Configurez HSTS avec `preload`
2. Soumettez sur https://hstspreload.org
3. **ATTENTION** : C'est quasi-irréversible !

---

## 🔍 Vérification des Headers

### Méthode 1 : DevTools du Navigateur

1. Ouvrez les DevTools (F12)
2. Onglet **Network**
3. Rechargez la page
4. Cliquez sur n'importe quelle requête
5. Onglet **Headers** → Section **Response Headers**

### Méthode 2 : curl

```bash
curl -I http://localhost:3000
```

### Méthode 3 : Outils en ligne

- https://securityheaders.com
- https://observatory.mozilla.org
- https://csp-evaluator.withgoogle.com

---

## 📊 Score de Sécurité Attendu

Avec cette configuration, vous devriez obtenir :

| Outil | Score Attendu |
|-------|---------------|
| SecurityHeaders.com | **A** (dev) / **A+** (prod avec HSTS) |
| Mozilla Observatory | **B+** (dev) / **A** (prod) |

---

## 🚀 Améliorations pour la Production

### 1. CSP Plus Stricte

```typescript
// Retirer unsafe-inline et unsafe-eval
"script-src 'self' 'nonce-{random}'",
"style-src 'self'",
```

Puis générer des nonces pour chaque requête :

```typescript
// server/middleware/csp-nonce.ts
export default defineEventHandler((event) => {
  const nonce = crypto.randomBytes(16).toString('base64')
  event.context.cspNonce = nonce
  // Injecter le nonce dans le CSP header
})
```

### 2. Subresource Integrity (SRI)

Pour les CDN externes :

```html
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 3. Feature Policy (ancien nom de Permissions-Policy)

Ajouter plus de restrictions :

```
payment=(), usb=(), magnetometer=(), gyroscope=(), fullscreen=(self)
```

### 4. CORS Headers

Pour les APIs, configurez CORS proprement :

```typescript
headers: {
  'Access-Control-Allow-Origin': 'https://votredomaine.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}
```

---

## ⚠️ Problèmes Connus et Solutions

### Problème 1 : CSP bloque les scripts inline de Vue

**Symptôme** : Erreurs console "Refused to execute inline script"

**Solution** :
- En dev : Autoriser `'unsafe-inline'` (déjà fait)
- En prod : Utiliser des nonces ou pré-compiler

### Problème 2 : Images externes bloquées

**Symptôme** : Images d'APIs tierces ne s'affichent pas

**Solution** : Ajouter le domaine dans `img-src` :

```typescript
"img-src 'self' data: https: blob: https://images.example.com",
```

### Problème 3 : WebSocket Supabase bloqué

**Symptôme** : Realtime Supabase ne fonctionne pas

**Solution** : Déjà configuré avec `wss://*.supabase.co` dans `connect-src`

### Problème 4 : HSTS en dev casse localhost

**Symptôme** : Impossible d'accéder à `http://localhost` après avoir visité la prod

**Solution** : HSTS uniquement en production (déjà implémenté)

---

## 📚 Ressources

### Documentation Officielle

- [MDN - HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [OWASP - Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [CSP Reference](https://content-security-policy.com/)

### Outils de Test

- [SecurityHeaders.com](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com)
- [HSTS Preload List](https://hstspreload.org)

### Standards

- [RFC 7034 - X-Frame-Options](https://tools.ietf.org/html/rfc7034)
- [RFC 6797 - HSTS](https://tools.ietf.org/html/rfc6797)
- [W3C CSP Level 3](https://www.w3.org/TR/CSP3/)

---

## 🔒 Impact sur la Conformité

### NF525

Les headers de sécurité renforcent la conformité NF525 en :
- Protégeant l'intégrité des données (CSP)
- Empêchant les modifications frauduleuses (X-Frame-Options)
- Garantissant la sécurité des communications (HSTS en prod)

### RGPD

Les headers contribuent à la protection des données personnelles :
- CSP limite les fuites de données vers des domaines tiers
- Referrer-Policy empêche la fuite d'URLs contenant des données sensibles
- HSTS protège les données en transit

---

**Date de création** : 2025-12-06
**Version** : 1.0
**Auteur** : Claude (Assistant IA)
