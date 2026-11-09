---
name: debut-session
description: Briefing de reprise FymPOS — lit l'état du projet, le confronte à git et au code, et propose la prochaine action. À utiliser en début de session, ou quand Yohan demande « où en est-on », « on reprend », « quel est l'état du projet ». Lecture seule.
---

# Début de session — FymPOS

But : dire à Yohan, en une dizaine de lignes, où en est le projet et quoi faire ensuite.

Cette étape est en **lecture seule**. Ne modifie aucun fichier, ne bascule pas d'environnement, ne lance aucune commande `db:*`. Si tu constates qu'un document est faux, tu le signales dans le briefing ; la correction se fait sur demande ou au `/fin-session`.

Yohan est le fondateur et seul développeur, technicien caisses de métier et pas développeur de formation : parle produit et conséquences concrètes, pas jargon.

## 1. Lire l'état déclaré

Lis `docs/etat-projet.md` en entier. C'est la page de référence : branches, bloquants, prochaines actions, actions côté fondateur. Ne lis le journal, le plan d'exécution ou le doc d'architecture que si la prochaine action l'exige.

## 2. Relever l'état réel

Le résumé injecté au démarrage (« [FymPOS — état au démarrage de la session] ») donne déjà la branche, l'environnement actif et les commits non poussés. Complète avec :

```bash
git status -sb
git log --oneline -5
git branch -vv
git stash list
```

Environnement actif, s'il n'est pas déjà connu — comparaison sans jamais afficher le contenu d'un `.env` :

```bash
for e in development staging production; do cmp -s .env .env.$e && echo "actif : $e"; done
```

Si l'environnement actif n'est pas `development`, c'est la **première ligne du briefing**, et aucune commande touchant la base ne part sans accord explicite.

Ne lance pas `git fetch` ni `git push` : la session n'a pas accès aux identifiants GitHub. L'état des branches distantes se lit d'après les refs locales, et il faut le dire tel quel.

## 3. Confronter la page au code

Une page d'état peut être fausse : elle est écrite par une session, lue par une autre. Avant de t'y fier, vérifie les deux ou trois affirmations dont dépend la prochaine action. Exemples :

- « branche X non mergée » → `git branch --merged developpement`
- « fonctionnalité Y livrée » → le fichier et ses tests existent, et les tests passent
- le commit de « Dernière vérification » est-il encore le dernier commit ? Sinon la page a du retard, et il faut regarder ce qui a été commité depuis (`git log <commit>..HEAD --oneline`).

Ne présente jamais une fonctionnalité comme terminée sur la seule foi d'un document.

## 4. Lancer les tests

```bash
pnpm vitest run --coverage.enabled=false --reporter=dot
```

Une quinzaine de secondes, sans rien écrire sur le disque (la couverture, activée par défaut dans `vitest.config.ts`, régénérerait le dossier `coverage/`). Rapporte le résultat tel qu'il est : nombre de tests, nombre de fichiers, échecs éventuels avec leur nom. N'en déduis rien sur le lint, le typecheck ou les e2e, qui ne sont pas lancés ici.

## 5. Rendre le briefing

Court, dans cet ordre :

1. **Alerte éventuelle** — environnement hors dev, tests rouges, travail présent sur cette seule machine.
2. **Où on en est** — branche, dernier travail fait, en une ou deux phrases.
3. **Ce qui bloque** — les bloquants de la page, confirmés ou infirmés.
4. **Écarts constatés** — ce que la page affirme et que git ou le code contredit. S'il n'y en a pas, le dire en une ligne.
5. **Prochaine action proposée** — une seule, celle que tu recommandes, avec la raison. Au plus une alternative.
6. **En attente côté fondateur** — rappel bref des actions hors code.

Termine en demandant à Yohan sur quoi il veut travailler.

## 6. Avant de démarrer la tâche choisie

- Une branche par tâche, créée depuis `developpement`.
- Si la tâche touche une zone 🔴 de `CLAUDE.md` (ventes, clôture, hash NF525, schéma, panier, authentification, multi-tenant) : plan mode d'abord, tests de caractérisation avant toute modification, et relecture des règles absolues concernées.
