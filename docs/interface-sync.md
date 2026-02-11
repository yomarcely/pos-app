# 🎨 Interface de Synchronisation - Documentation

## ✅ Ce qui a été créé

### 📄 **Pages créées**

#### **1. Page de synchronisation** : `/pages/etablissements/synchronisation.vue`
- **Route** : `/etablissements/synchronisation`
- **Fonctionnalités** :
  - ✅ Liste tous les groupes de synchronisation
  - ✅ Affiche les établissements de chaque groupe
  - ✅ Affiche les règles de synchronisation (produits & clients)
  - ✅ Création de nouveaux groupes
  - ✅ Configuration des règles existantes
  - ✅ Suppression des groupes
  - ✅ Empty state informatif
  - ✅ Interface responsive

#### **2. Page établissements modifiée** : `/pages/etablissements/index.vue`
- **Ajouts** :
  - ✅ Bouton "Synchronisation" dans le header
  - ✅ Navigation vers la page de synchronisation
  - ✅ Icône `Network` pour la synchronisation

---

### 🧩 **Composants créés**

#### **1. RuleItem** : `/components/sync/RuleItem.vue`
- **Usage** : Affiche une règle de synchronisation avec icône (✓ ou ✗)
- **Props** :
  - `label` : Nom de la règle
  - `enabled` : État activé/désactivé
- **Exemple** :
  ```vue
  <RuleItem label="Prix TTC" :enabled="true" />
  ```

---

### 🌐 **API créées**

#### **Nouvelle API** : `DELETE /api/sync-groups/:id`
- **Fichier** : `/server/api/sync-groups/[id]/delete.delete.ts`
- **Fonction** : Supprime un groupe de synchronisation
- **Suppression en cascade** : Les liaisons et règles sont automatiquement supprimées

#### **Récapitulatif des API disponibles**
```
GET    /api/sync-groups                     → Liste des groupes
POST   /api/sync-groups/create              → Créer un groupe
GET    /api/sync-groups/:id                 → Détails d'un groupe
PATCH  /api/sync-groups/:id/rules           → Modifier les règles
DELETE /api/sync-groups/:id                 → Supprimer un groupe ✨ NOUVEAU
```

---

## 🎨 **Interface Utilisateur**

### **Navigation**
```
Page Établissements
    ↓ [Bouton "Synchronisation"]
Page Synchronisation
    ├─ Liste des groupes
    ├─ Créer un groupe
    ├─ Configurer les règles
    └─ Supprimer un groupe
```

---

### **Écran : Page de Synchronisation**

#### **Header**
```
┌─────────────────────────────────────────────────────────┐
│  Synchronisation Multi-Établissements                   │
│  Gérez les groupes de synchronisation et les règles     │
│                                                          │
│  [← Retour]                    [+ Nouveau groupe]       │
└─────────────────────────────────────────────────────────┘
```

#### **Info Box** (si aucun groupe)
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  À quoi sert la synchronisation ?                    │
│                                                          │
│  Les groupes de synchronisation permettent de partager  │
│  automatiquement les produits et clients entre          │
│  plusieurs établissements, tout en conservant un        │
│  stock indépendant par établissement.                   │
└─────────────────────────────────────────────────────────┘
```

#### **Carte de groupe**
```
┌─────────────────────────────────────────────────────────┐
│  Réseau France                          [⚙️ Configurer] [🗑️]  │
│  Synchronisation Paris-Lyon                             │
│  🏢 2 établissements                                     │
│                                                          │
│  Établissements synchronisés                            │
│  [Paris • Paris] [Lyon • Lyon]                          │
│                                                          │
│  ────────────────────────────────────────────────────  │
│                                                          │
│  📦 Règles Produits          👥 Règles Clients          │
│  ✓ Nom                       ✓ Informations             │
│  ✓ Description               ✓ Contact                  │
│  ✓ Code-barres               ✓ Adresse                  │
│  ✓ Catégorie                 ✓ RGPD                     │
│  ✗ Prix TTC                  ✗ Programme fidélité       │
│  ✓ Prix HT                   ✗ Remise                   │
│  ✓ TVA                                                   │
│  ✓ Image                                                 │
└─────────────────────────────────────────────────────────┘
```

---

### **Dialog : Créer un groupe**

#### **Section 1 : Informations de base**
```
Nom du groupe *
[Réseau France                                          ]

Description
[Synchronisation des magasins Paris et Lyon            ]
```

#### **Section 2 : Sélection des établissements**
```
Établissements à synchroniser *
Sélectionnez au moins 2 établissements

┌─────────────────────────────────────┐
│ ☑ Paris • Paris                     │
│ ☑ Lyon • Lyon                       │
│ ☐ Marseille • Marseille             │
│ ☐ Toulouse • Toulouse               │
└─────────────────────────────────────┘
```

#### **Section 3 : Règles Produits**
```
📦 Règles de synchronisation des produits

┌─────────────────────────────────────────────────────┐
│ ☑ Nom du produit         ☑ Fournisseur              │
│ ☑ Description            ☑ Marque                   │
│ ☑ Code-barres            ☑ Prix HT                  │
│ ☑ Catégorie              ☐ Prix TTC ⭐ Recommandé   │
│ ☑ TVA                    ☑ Image                    │
│ ☑ Variations                                        │
└─────────────────────────────────────────────────────┘
```

#### **Section 4 : Règles Clients**
```
👥 Règles de synchronisation des clients

┌─────────────────────────────────────────────────────┐
│ ☑ Informations (nom, prénom)                        │
│ ☑ Contact (email, tél)                              │
│ ☑ Adresse                                           │
│ ☑ Consentements RGPD                                │
│ ☐ Programme fidélité ⭐ Fidélité locale recommandée │
│ ☐ Remise ⭐ Remise locale recommandée               │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 **Flux Utilisateur**

### **Scénario 1 : Créer son premier groupe**

```
1. Page Établissements
   → Clic sur [Synchronisation]

2. Page Synchronisation (vide)
   → Info box explicative
   → Clic sur [+ Nouveau groupe]

3. Dialog Créer un groupe
   → Remplir le nom : "Réseau France"
   → Sélectionner Paris et Lyon
   → Cocher les règles :
      ✓ Nom, Description, Catégorie
      ✗ Prix TTC (différent par établissement)
   → Clic sur [Créer le groupe]

4. Retour à la liste
   → Le groupe "Réseau France" apparaît
   → Toast : "Groupe créé avec succès"
```

### **Scénario 2 : Modifier les règles**

```
1. Page Synchronisation
   → Sélectionner un groupe
   → Clic sur [⚙️ Configurer]

2. Dialog Configuration
   → Modifier les checkboxes
      Exemple : Activer "Prix TTC"
   → Clic sur [Enregistrer]

3. Retour à la liste
   → Les règles sont mises à jour
   → Toast : "Règles mises à jour"
```

### **Scénario 3 : Supprimer un groupe**

```
1. Page Synchronisation
   → Clic sur [🗑️] d'un groupe

2. Dialog Confirmation
   → "Les données resteront intactes"
   → Clic sur [Supprimer]

3. Retour à la liste
   → Le groupe disparaît
   → Toast : "Groupe supprimé"
```

---

## 🎯 **Cas d'Usage Réels**

### **Cas 1 : Prix différents par établissement**

**Besoin** : Un café à 2€ à Paris, 2,50€ à Lyon

**Configuration** :
```
Groupe : "Cafés France"
Établissements : Paris, Lyon

Règles Produits :
✓ Nom               → Même nom partout
✓ Description       → Même description
✓ Catégorie         → Même catégorie
✗ Prix TTC          → Prix différent ! ⭐
✓ Image             → Même image
```

**Résultat** :
- Produit "Café Expresso" créé à Paris à 2€
- Automatiquement créé à Lyon
- Prix à Lyon **non synchronisé** → Définir manuellement 2,50€

---

### **Cas 2 : Fidélité locale**

**Besoin** : Programme fidélité indépendant par établissement

**Configuration** :
```
Groupe : "Réseau France"

Règles Clients :
✓ Informations      → Client reconnu partout
✓ Contact           → Email/Tel partagés
✗ Fidélité          → Points locaux ! ⭐
✗ Remise            → Remise locale
```

**Résultat** :
- Client "Jean Dupont" reconnu dans tous les magasins
- Points de fidélité différents par magasin
- Remises différentes par magasin

---

## 📊 **Indicateurs Visuels**

### **Légende des icônes**

| Icône | Signification |
|-------|---------------|
| ✓ | Règle activée (synchronisé) |
| ✗ | Règle désactivée (indépendant) |
| 🏢 | Établissement |
| 📦 | Produits |
| 👥 | Clients |
| ⚙️ | Configuration |
| 🗑️ | Supprimer |
| ℹ️ | Information |

### **États des règles**

```css
✓ Règle activée
  → Icône verte
  → Texte noir
  → Les modifications seront synchronisées

✗ Règle désactivée
  → Icône grise
  → Texte gris
  → Paramètre indépendant par établissement
```

---

## 🚀 **Prochaines Améliorations Possibles**

### **Fonctionnalités à ajouter**

1. **Ajouter/Retirer des établissements** d'un groupe existant
   ```
   [+ Ajouter un établissement]
   → Dialog avec liste des établissements non inclus
   ```

2. **Historique des synchronisations**
   ```
   Onglet "Historique"
   → Liste des sync_logs
   → Qui a modifié quoi et quand
   ```

3. **Prévisualisateur de synchronisation**
   ```
   Avant de créer un groupe :
   → "123 produits seront synchronisés"
   → "45 clients seront partagés"
   ```

4. **Templates de règles**
   ```
   Modèles prédéfinis :
   - "Synchronisation complète"
   - "Prix locaux uniquement"
   - "Catalogue partagé"
   ```

5. **Notifications en temps réel**
   ```
   Quand un produit est synchronisé :
   → Toast : "Produit 'Café' synchronisé vers Lyon"
   ```

---

## 🎨 **Personnalisation**

### **Couleurs utilisées**

```css
/* Succès / Activé */
text-green-600    → Icônes activées
bg-green-50       → Fonds de succès

/* Neutre / Désactivé */
text-gray-500     → Texte désactivé
bg-gray-100       → Fonds neutres

/* Information */
text-blue-600     → Icônes info
bg-blue-50        → Info box

/* Actions */
text-gray-900     → Texte principal
border-gray-200   → Bordures
```

### **Espacements**

```css
space-y-6    → Espacement vertical sections
gap-4        → Espacement grilles
p-6          → Padding cartes
```

---

## 📱 **Responsive**

L'interface s'adapte automatiquement :

```
Desktop (≥768px)
├─ Règles sur 2 colonnes
├─ Établissements en grille 2 colonnes
└─ Dialogs larges (max-w-4xl)

Mobile (<768px)
├─ Règles sur 1 colonne
├─ Établissements en liste
└─ Dialogs pleine largeur
```

---

## ✅ **Checklist Interface**

- [x] ✅ Page de synchronisation créée
- [x] ✅ Bouton d'accès depuis page établissements
- [x] ✅ Liste des groupes avec détails
- [x] ✅ Création de groupe avec règles
- [x] ✅ Modification des règles
- [x] ✅ Suppression de groupe
- [x] ✅ Empty state informatif
- [x] ✅ Composant RuleItem
- [x] ✅ API DELETE groupe
- [x] ✅ Responsive design
- [x] ✅ Toasts de confirmation
- [x] ✅ Dialogs de confirmation

---

**🎉 L'interface de synchronisation est complète et prête à l'emploi !**

*Dernière mise à jour : 2025-12-10*
