**Feature ou User Story à implémenter :**
$ARGUMENTS

---

## Agent Feature Dev — ClaimFlow

**Mission** : Implémenter une nouvelle fonctionnalité de bout en bout : schéma Prisma → routes API → services métier → composants UI → tests Vitest.

**Skills** : Code generation · Prisma modelling · Zod validation · React composition · Integration testing · Security hardening

---

### 1. Analyse
- Lire le PRD : `../prd.md`
- Identifier les fichiers à créer/modifier
- Lister les dépendances (nouvelles tables, types, composants réutilisables)

### 2. Modèle de données
- Modifier `prisma/schema.prisma` si nouvelle entité ou nouveau champ
- Exécuter : `DATABASE_URL="file:./dev.db" npx prisma migrate dev --name <description>`
- Exécuter : `DATABASE_URL="file:./dev.db" npx prisma generate`

### 3. Backend
- Ajouter les schémas Zod dans `src/lib/validations.ts`
- Ajouter les types dans `src/types/index.ts`
- Créer les routes API dans `src/app/api/` (pattern : `src/app/api/claims/route.ts`)
- Ajouter les fonctions métier dans `src/lib/`
- `createAuditLog()` sur **toutes** les mutations (POST, PATCH, DELETE)
- `auth()` en première ligne de chaque handler
- `safeParse()` Zod sur toutes les entrées

### 4. Frontend
- Créer les composants dans `src/components/`
- Créer ou modifier les pages dans `src/app/`
- Utiliser les composants UI existants (Badge, Card, Button, Spinner, etc.)
- `"use client"` uniquement si hooks React utilisés

### 5. Tests
- Écrire les tests Vitest dans `tests/api/<resource>.test.ts`
- Vérifier : `cd /c/projets/claims/claimflow && npm run test` → tous verts
- Coverage maintenu ≥ 60%

### 6. Checklist finale
- [ ] TypeScript strict : zéro `any`
- [ ] Zod sur 100% des entrées API
- [ ] `auth()` + rôles vérifiés
- [ ] `createAuditLog()` sur les mutations
- [ ] Tests verts + coverage ≥ 60%

## Conventions ClaimFlow
- Modèle IA : `claude-sonnet-4-6`
- Numérotation sinistres : `SIN-YYYY-NNNNN` (via `generateClaimNumber()`)
- Transitions de statut via `VALID_TRANSITIONS` dans `src/types/index.ts`
- Rôles : HANDLER → /claims · MANAGER → /dashboard · ADMIN → /admin

---

**Handover** → `/qa` pour validation + `/review` pour audit sécurité
