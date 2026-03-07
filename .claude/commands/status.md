Dashboard de santé du projet (optionnel — périmètre spécifique) :
$ARGUMENTS

---

## Status — ClaimFlow

Donne une vue d'ensemble rapide de l'état du projet.

### 1. Serveur de développement

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "DOWN"
```

Si DOWN → rappeler : `cd /c/projets/claims/claimflow && npm run dev`

### 2. Base de données

```bash
cd /c/projets/claims/claimflow && DATABASE_URL="file:./dev.db" npx prisma db execute --stdin <<'SQL'
SELECT
  (SELECT COUNT(*) FROM User) as users,
  (SELECT COUNT(*) FROM Claim) as claims,
  (SELECT COUNT(*) FROM Policyholder) as policyholders,
  (SELECT COUNT(*) FROM Document) as documents,
  (SELECT COUNT(*) FROM AuditLog) as audit_logs;
SQL
```

### 3. Tests Vitest

```bash
cd /c/projets/claims/claimflow && npm run test -- --reporter=verbose --run 2>&1 | tail -20
```

### 4. Git

```bash
git -C /c/projets/claims status --short
git -C /c/projets/claims log --oneline -5
```

### 5. Rapport final

```
ClaimFlow — Status
──────────────────────────────────
Serveur     : UP (http://localhost:3000) | DOWN
BDD         : X sinistres · Y assurés · Z documents
Tests       : X/Y passés (coverage Z%)
Git         : [branche] — [X fichiers modifiés non commités]
Derniers commits :
  [liste des 5 derniers]
──────────────────────────────────
Actions recommandées : [liste si problèmes détectés]
```

**Handover :** `/seed` si BDD vide · `/test` si tests rouges · `/commit` si changements non commités
