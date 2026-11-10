---
name: fin-session
description: Clôture de session FymPOS — vérifie le travail (pnpm run ci), réécrit docs/etat-projet.md, ajoute la ligne de journal, met à jour la checklist du plan, puis propose le commit et le push. À utiliser quand Yohan dit « fin de session », « on s'arrête là », « on clôture », ou avant de fermer une session où du travail a été fait.
---

# Fin de session — FymPOS

But : que la prochaine session, dans une heure ou dans deux mois, reprenne sans rien avoir à reconstituer. Tout ce que tu écris ici sera lu par une session qui n'a aucun souvenir de celle-ci : n'écris que ce qui a été vérifié, et marque le reste « à vérifier ».

## 1. Inventorier ce que la session a réellement changé

D'après git, pas de mémoire :

```bash
git status --short
git diff --stat
git log --oneline developpement..HEAD
```

Sépare ce qui est commité, ce qui est modifié sans être commité, et ce qui n'est pas poussé.

## 2. Vérifier

- Du code a changé (autre chose que `docs/`, `.claude/` ou des fichiers `.md`) : lance `pnpm run ci` (lint, typecheck, audits tenant et migrations, tests). Le mot `run` est obligatoire : `pnpm ci` tout court est une commande interne de pnpm qui échoue sans rien vérifier.
- Seulement de la documentation ou de la configuration Claude : `pnpm run ci` n'apporte rien, dis-le plutôt que de le lancer.

Rapporte le résultat tel qu'il est. Si c'est rouge, la page d'état dit rouge, avec le nom de ce qui échoue : une page qui annonce du vert alors que la CI est rouge est pire que pas de page.

Si une zone 🔴 de `CLAUDE.md` a été touchée, vérifie qu'un test de régression couvre le changement. S'il n'y en a pas, c'est un bloquant à signaler avant tout commit (règles absolues 3 et 4).

Deux agents relecteurs existent pour ces cas, en lecture seule. Propose à Yohan de les lancer avant le commit, et ne les lance qu'avec son accord (ils prennent quelques minutes) :
- `gardien-nf525` — le diff touche les ventes, la clôture, le hash, les montants ou le panier ;
- `gardien-tenant-auth` — le diff ajoute ou modifie un endpoint, l'authentification, les rôles ou un store persistant.

Leurs constats bloquants se corrigent avant le commit, ou se notent tels quels dans `docs/etat-projet.md` si Yohan décide de committer quand même.

## 3. Réécrire `docs/etat-projet.md`

Réécrire, pas compléter : la page décrit le présent et tient sur une page (environ 80 lignes). Garde ses sections.

- **Dernière vérification** : date du jour, commit courant, chiffres mesurés *pendant cette session*, et la liste de ce qui n'a pas été relancé.
- **Branches** : d'après `git branch -vv`, avec pour chacune si elle est poussée et mergée.
- **Bloquants** et **Prochaines actions** : retire ce qui est résolu, ajoute ce qui est apparu, garde l'ordre de priorité.
- **Côté fondateur** : les actions hors code encore en attente.
- Ce qui est terminé quitte la page. Sa trace est dans le journal.

## 4. Ajouter une ligne au journal

Dans `docs/journal.md`, une ligne à la fin du tableau « Sessions », au format existant : date, module traité, actions effectuées, statut. Dis ce qui a été fait et pourquoi, avec les noms de fichiers et les commits utiles pour retrouver le travail plus tard. Le journal s'empile et ne se réécrit pas.

## 5. Mettre à jour le reste, seulement si la session l'a changé

- **Checklist du plan** (`docs/architecture/2026-07-plan-execution-phases-1-2.md`) : un élément se coche une fois mergé. Livré mais pas mergé : note l'état sur sa ligne sans le cocher.
- **Décision structurante** prise pendant la session : une ligne dans le tableau « Décisions actées » (§10) de `docs/architecture/2026-07-audit-architecture-cible.md`.
- **`CLAUDE.md`** : ne le modifie pas. Son en-tête exige une validation explicite. Si un risque ouvert est résolu, qu'un invariant a changé ou qu'une ligne est devenue fausse, montre à Yohan la modification proposée et attends son accord.
- **Mémoire Claude** : uniquement une décision durable ou une préférence de travail de Yohan. Jamais d'état courant, il vit dans `docs/etat-projet.md`.

## 6. Proposer le commit

Présente la liste des fichiers et le message, au format du dépôt (`type(scope): résumé` en français, corps expliquant le pourquoi), puis attends l'accord de Yohan.

- Ajoute les fichiers nommément, jamais `git add -A` : les `.env` et les artefacts ne doivent pas partir par accident.
- Ne pousse qu'après un accord explicite de Yohan, demandé séparément du commit : un push vers `developpement` lance la CI, un push vers `main` déploie le staging. Si le push échoue faute d'identifiants, donne-lui la commande `git push` exacte à lancer dans son terminal.
- Rien ne part vers `main` depuis cette étape. Un merge `developpement` → `main` déclenche un déploiement staging et suit le runbook `docs/runbooks/deploy-staging-vercel.md`.

## 7. Rendre le compte rendu

Quatre rubriques courtes : ce qui a été fait ; ce qui a été vérifié, avec les résultats ; ce qui n'a pas été vérifié ; ce qui reste à faire par Yohan (push, actions fondateur).
