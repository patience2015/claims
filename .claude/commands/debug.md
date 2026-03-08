**Erreur ou comportement à déboguer :**
$ARGUMENTS

---

## Debug — ClaimFlow

Analyse une erreur ou un comportement inattendu et propose un correctif.

### 1. Identification

À partir de `$ARGUMENTS` (message d'erreur, stack trace, description du bug) :
- Identifier le fichier source (route API ? service ? composant ? hook ?)
- Lire les fichiers concernés dans `src/`
- Reproduire mentalement le chemin d'exécution

### 2. Catégories fréquentes dans ClaimFlow

| Symptôme | Fichiers à lire en priorité |
|----------|-----------------------------|
| 401 / session perdue | `src/lib/auth.ts` · `src/middleware.ts` |
| 403 rôle refusé | `src/lib/permissions.ts` · route concernée |
| Erreur Prisma / BDD | `prisma/schema.prisma` · service concerné |
| Erreur Zod validation | `src/lib/validations.ts` · route concernée |
| Composant ne s'affiche pas | composant `src/components/` · page `src/app/` |
| Analyse IA échoue / timeout | `src/lib/ai-service.ts` · `src/app/api/ai/*/route.ts` |
| Upload document échoue | `src/app/api/claims/[id]/documents/route.ts` |
| Test Vitest rouge | `tests/` · fichier source testé |
| Test E2E rouge | `e2e/` · page ou API concernée |

### 3. Protocole de diagnostic

1. Lire les fichiers identifiés
2. Identifier la cause racine (pas les symptômes)
3. Vérifier l'audit trail : `AuditLog` en BDD pour tracer les mutations
4. Proposer le correctif minimal — ne pas refactorer au-delà du bug
5. Indiquer si un test doit être mis à jour

### 4. Correction

- Appliquer le fix avec l'outil Edit
- Si le bug est lié à un test cassé : corriger l'implémentation, jamais le test
- Si la cause racine est dans le schéma Prisma → invoquer `/migrate`
- Relancer les tests concernés pour valider

### 5. Rapport

```
Bug     : [description courte]
Cause   : [cause racine identifiée]
Fix     : [fichier:ligne — ce qui a changé]
Tests   : [verts / à relancer]
```
