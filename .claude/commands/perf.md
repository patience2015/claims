**Périmètre de l'audit (optionnel — route, composant, ou "tout") :**
$ARGUMENTS

---

## Perf — Audit Performance ClaimFlow

Identifie les problèmes de performance : requêtes N+1, routes lentes, bundle lourd.

### 1. Requêtes N+1 (Prisma)

Rechercher les `findMany` sans `include` groupé ou avec include dans une boucle :

```bash
grep -n "findMany\|findFirst\|findUnique" /c/projets/claims/claimflow/src/lib/*.ts /c/projets/claims/claimflow/src/app/api/**/route.ts
```

Patterns à détecter :
- `await prisma.X.findMany()` suivi d'un `.map(async ...)` qui fait un autre appel Prisma → **N+1**
- `include: { relation: true }` sur `findMany` sans pagination → **over-fetching**

Correction : regrouper les includes, utiliser `select` minimal, paginer avec `take`/`skip`.

### 2. Routes API lentes

Lire les routes API candidates (`$ARGUMENTS` ou toutes les routes) dans `src/app/api/` et vérifier :

| Problème | Signal |
|----------|--------|
| Appel IA bloquant | `await ai-service.analyze*()` dans une route GET |
| Pas de pagination | `findMany` sans `take`/`skip` |
| Include trop large | `include: { documents: true, auditLogs: true, ... }` |
| Appels séquentiels | plusieurs `await prisma.*` indépendants → remplacer par `Promise.all()` |

### 3. Bundle frontend

```bash
cd /c/projets/claims/claimflow && npm run build 2>&1 | grep -E "Route|Size|First Load"
```

Chercher :
- Pages > 100 kB First Load JS → candidat au lazy loading
- Imports non tree-shakés : vérifier les imports `lucide-react` (préférer `import { Icon } from "lucide-react/dist/esm/icons/icon"`)

### 4. Composants React

Chercher les re-renders inutiles :
- `useEffect` avec dépendances manquantes ou trop larges
- Fetch dans le render sans `useMemo`/`useCallback`
- Composants non mémoïsés recevant des objets/fonctions en prop inline

### 5. Rapport

```
Perf Audit — ClaimFlow
──────────────────────────────────
N+1 détectés    : [liste fichier:ligne]
Routes lentes   : [liste avec raison]
Bundle          : [pages > 100kB]
Corrections     : [liste des fixes appliqués]
Gains estimés   : [impact attendu]
──────────────────────────────────
```

**Handover :** `/review` pour audit qualité complet · `/test` pour vérifier que les fixes ne cassent rien
