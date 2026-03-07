**Fichiers ou périmètre à revoir :**
$ARGUMENTS

---

## Agent Release/Review — Sécurité & Livraison

**Mission** : Revue de code complète, conventions, audit sécurité, optimisation perf, préparation commit et démo.

**Skills** : Code review · Multi-file edit · Security hardening · /commit · CI basics

---

### 1. Revue de code

Lire les fichiers récemment modifiés et auditer sur ces axes :

#### Sécurité
- [ ] Aucune injection possible (SQL via Prisma ORM = OK, mais vérifier les `$queryRaw`)
- [ ] Mots de passe hashés avec bcryptjs (jamais en clair)
- [ ] Tokens/secrets uniquement dans `.env.local` (jamais hardcodés)
- [ ] CSRF protégé par NextAuth
- [ ] Données utilisateur filtrées selon le rôle (HANDLER ne voit que ses sinistres)
- [ ] Fichiers uploadés validés côté serveur (type MIME + taille), pas seulement côté client

#### Performance
- [ ] Requêtes Prisma avec `select` minimal (pas `include: { everything: true }`)
- [ ] Pagination systématique sur les listes (pas de `findMany()` sans `take`)
- [ ] Index Prisma sur les champs filtrés fréquemment (`status`, `createdByID`, `policyholderID`)
- [ ] Pas de N+1 (utiliser `include` plutôt que boucle de requêtes)

#### Lisibilité
- [ ] Fonctions < 50 lignes (sinon extraire)
- [ ] Noms de variables explicites (pas de `d`, `tmp`, `res2`)
- [ ] Commentaires uniquement sur la logique non évidente
- [ ] TypeScript strict : zéro `any`, zéro `// @ts-ignore`

#### Conventions ClaimFlow
- [ ] `auth()` en première ligne de chaque API handler
- [ ] `createAuditLog()` sur toutes les mutations
- [ ] Codes HTTP corrects (201 create, 400 validation, 401 auth, 403 role)
- [ ] Modèle IA : `claude-sonnet-4-6` partout

### 2. Rapport de review
Format :
```
## Review — <fichier ou feature>

### Problèmes critiques 🔴
- [ligne X] Description + correction suggérée

### Améliorations recommandées 🟡
- [ligne X] Description

### Points positifs ✅
- Ce qui est bien fait

### Score global : X/10
```

### 3. Corrections
Appliquer les corrections critiques directement.
Pour les améliorations : proposer et attendre confirmation.

### 4. Préparation du commit
Après corrections validées, générer un message de commit conventionnel :
```
<type>(<scope>): <sujet court>

<body — pourquoi ce changement>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Types : `feat` · `fix` · `refactor` · `test` · `chore` · `docs`
Scopes : `auth` · `claims` · `ai` · `dashboard` · `admin` · `tests` · `mcp`

### 5. Checklist démo finale (15 min)
- [ ] `npm run dev` démarre sans erreur TypeScript
- [ ] Login handler → redirigé vers /claims ✓
- [ ] Login manager → redirigé vers /dashboard ✓
- [ ] Créer un sinistre (formulaire 4 étapes) ✓
- [ ] Lancer l'analyse IA → score fraude + estimation ✓
- [ ] Dashboard KPIs + charts ✓
- [ ] `npm run test` → tous verts, coverage ≥ 60% ✓

---

**Handover** → Livraison / démo
