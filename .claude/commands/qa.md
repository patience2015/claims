**Périmètre ou contexte de test :**
$ARGUMENTS

---

## Agent QA — Tests & Qualité

**Mission** : TDD backend (Vitest), tests composants React, E2E Playwright, coverage > 60%, détection de régressions.

**Skills** : TDD · Scenario building · E2E planning · Bug reproduction · Coverage optimisation

---

### 1. Tests d'intégration API (Vitest)
Emplacement : `tests/api/<resource>.test.ts`

**Pattern de mock obligatoire** :
```typescript
vi.mock("@/lib/prisma", () => ({ prisma: { <model>: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() } } }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/claim-service", () => ({ getVisibleClaimsWhere: vi.fn().mockResolvedValue({}), generateClaimNumber: vi.fn().mockResolvedValue("SIN-2026-00001") }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
```

**Cas à couvrir systématiquement** :
- `401` si non authentifié
- `400` si données invalides (Zod)
- `200/201` succès nominal
- Pagination (page, pageSize, totalPages)
- Filtrage (status, type, search)
- Ordre par défaut (createdAt desc)

**Attention cuid** : `policyholderID` doit être un cuid valide (`/^c[^\s-]{8,}$/i`), ex: `"cjld2cyuq0000t3rmniod1foy"`

### 2. Tests composants (Vitest + Testing Library)
Emplacement : `tests/components/<Component>.test.tsx`

**Pattern setup** (déjà configuré dans `tests/setup.ts`) :
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComponentName } from "@/components/...";
```

**Cas à couvrir** :
- Rendu nominal avec props minimales
- Chaque variante (LOW/MODERATE/HIGH/CRITICAL pour FraudScoreCard, etc.)
- Éléments conditionnels (affichés seulement si prop présente)
- Interactions utilisateur (click, input) si composant interactif

**Attention éléments multiples** : utiliser `getAllByText().length > 0` si le texte apparaît plusieurs fois dans le DOM.

### 3. Tests E2E Playwright
Emplacement : `e2e/<scenario>.spec.ts`

**Prérequis** : serveur dev running sur http://localhost:3000 + BDD seedée.

**Scénarios obligatoires** :
- `e2e/login.spec.ts` : login valide handler/manager, login invalide, redirection par rôle
- `e2e/create-claim.spec.ts` : créer un sinistre (formulaire 4 étapes), validation erreurs, upload
- `e2e/dashboard.spec.ts` : affichage KPIs, sélecteur période, accès interdit au handler

**Pattern beforeEach** :
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.fill('[id="email"]', "manager@claimflow.fr");
  await page.fill('[id="password"]', "manager123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
});
```

### 4. Coverage cible
```
Statements : ≥ 60%
Branches   : ≥ 60%
Functions  : ≥ 60%
Lines      : ≥ 60%
```
Lancer : `cd /c/projets/claims/claimflow && npm run test`
Rapport HTML dans : `coverage/index.html`

### 5. Workflow de correction
Si un test échoue :
1. Lire le message d'erreur exact
2. Lire le fichier source + le fichier test
3. Identifier : bug dans l'implémentation OU assertion incorrecte dans le test
4. Corriger la **cause racine** — ne jamais supprimer un test
5. Relancer jusqu'à tous verts

---

**Handover** ↔ `/backend` + `/frontend` (boucles de fix)
