Spec ou scénario à tester (optionnel) :
$ARGUMENTS

---

## Tests E2E Playwright — ClaimFlow

Exécute les tests end-to-end et corrige les échecs.

### 1. Vérification BDD
```bash
cd /c/projets/claims/claimflow
DATABASE_URL="file:./dev.db" npx prisma db seed 2>/dev/null || true
```

### 2. Exécution

Si $ARGUMENTS est vide → lancer tous les specs :
```bash
cd /c/projets/claims/claimflow && npx playwright test --reporter=list
```

Si $ARGUMENTS contient un nom de spec (ex: "login", "dashboard") :
```bash
cd /c/projets/claims/claimflow && npx playwright test e2e/<spec>.spec.ts --reporter=list
```

### 3. Specs disponibles
| Spec | Scénarios |
|------|-----------|
| `login.spec.ts` | Login valide handler/manager, login invalide, redirection par rôle |
| `create-claim.spec.ts` | Formulaire 4 étapes, validation erreurs, upload documents |
| `dashboard.spec.ts` | KPIs, charts, accès interdit au handler |
| `business-audit.spec.ts` | Auto-approbation < 2000€ & fraude < 30, escalade fraude > 70 |

### 4. Comptes de test
- `julie@claimflow.ai` / `password123` → Gestionnaire → /claims
- `marc@claimflow.ai` / `password123` → Manager → /dashboard
- `thomas@claimflow.ai` / `password123` → Admin → /admin

### 5. En cas d'échec
1. Lire le message d'erreur (selector, timeout, assertion)
2. Lire le spec concerné dans `e2e/`
3. Lire la page/composant correspondant dans `src/app/`
4. Corriger la cause racine (jamais supprimer un test)
5. Relancer jusqu'à tous verts

### 6. Rapport
```
E2E Playwright
Specs  : X/Y passés
Durée  : Xs
Échecs : [liste]
Rapport HTML : claimflow/playwright-report/index.html
```

---

**Handover** → `/qa` pour les tests unitaires Vitest · `/review` après validation complète
