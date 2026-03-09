---
name: git-manager
description: Skill de directives expertes pour la gestion avancée de Git (Lecture de logs, formatage de commit, revue de PR locale, résolution complexe de rebase/merge).
---

# Skill: Git Manager

Ce skill équipe vos agents d'une méthodologie experte pour interagir avec le repo Git du projet ClaimFlow.

## Standards exigés sur le projet

### 1. Philosophie des commits
- **Unicité** : Un commit par fonctionnalité technique ou fonctionnelle claire. Pas de commits du type `fix: bug en vrac`.
- **Atomicité** : Le projet doit pouvoir faire un build ou passer les tests après CHAQUE commit (ne pas casser le code au milieu de l'historique).
- **Format** : Utiliser la convention "Conventional Commits". Les scopes valides pour ClaimFlow : `core`, `portail`, `intranet`, `api`, `auth`, `ui`, `ci`.

### 2. Revue de code (Pre-commit / Pre-push)
Lorsqu'un agent fait une "Revue de code" ou lit un `git diff` :
- Vérifier la typographie Zod et TypeScript (aucun `any` dissimulé).
- Vérifier la présence accidentelle de variables d'environnement (`process.env.GROQ_API_KEY`) qui devraient être extraites dans `.env.local`.
- Vérifier les règles d'Audit de la base : Toute méthode d'API POST/PATCH doit comporter un appel à `createAuditLog()`.

### 3. Gestion des Conflits de Fusion (Merge/Rebase Conflicts)
Si la console indique `CONFLICT (content): Merge conflict in ...` :
1. N'utilisez **jamais** de commande brute comme `git checkout --ours` sans lire soigneusement le fichier.
2. Lisez le contenu contenant les marqueurs de conflit (`<<<<<<< HEAD`, `=======`, `>>>>>>>`).
3. Construisez le contenu final qui fusionne intelligemment la logique ClaimFlow et modifiez le fichier.
4. Effectuez `git add` sur le fichier résolu.
5. Poursuivez avec `git rebase --continue` ou `git commit`.

### 4. Bonnes commandes Bash à utiliser
* Voir le statut propre : `git status -s`
* Voir les logs graphiques (5 derniers) : `git log --oneline --graph --decorate -n 5`
* Restaurer un fichier local cassé : `git restore <fichier>`
* Ajouter dynamiquement des fichiers : `git add <fichier1> <fichier2>` (Privilégiez les ajouts ciblés plutôt que `git add .` quand des fichiers instables trainent).
