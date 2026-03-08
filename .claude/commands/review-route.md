Review a ClaimFlow API route file for convention compliance.

Route file to review: $ARGUMENTS

If not provided above, ask the user which route file to review.

Read the specified `src/app/api/**/route.ts` file, then audit it against the ClaimFlow checklist:

**Auth & Sécurité**
- [ ] `auth()` appelé en première instruction de chaque handler
- [ ] Retourne `401` si session null
- [ ] Retourne `403` si rôle insuffisant (HANDLER ne peut pas accéder aux routes ADMIN/MANAGER)
- [ ] Aucun `any` TypeScript — types stricts partout

**Validation des entrées**
- [ ] `ClaimQuerySchema.safeParse()` sur les query params (GET)
- [ ] Schema Zod dédié `.safeParse()` sur le body (POST/PATCH)
- [ ] Retourne `400` avec `{ error, details }` si validation échoue
- [ ] Aucune entrée non validée ne passe dans Prisma

**Audit trail**
- [ ] `createAuditLog()` appelé sur toutes les mutations (POST, PATCH, DELETE, status change)
- [ ] `action` enum correct (CLAIM_CREATED, STATUS_CHANGED, etc.)
- [ ] `before`/`after` passés pour les mises à jour

**Codes HTTP**
- [ ] `200` GET success
- [ ] `201` POST success (création)
- [ ] `400` Validation error
- [ ] `401` Non authentifié
- [ ] `403` Non autorisé (rôle)
- [ ] `404` Ressource introuvable
- [ ] `500` Erreur serveur (avec try/catch)

**Qualité**
- [ ] `try/catch` autour des opérations Prisma
- [ ] Pas de données sensibles exposées (mot de passe hashé, etc.)
- [ ] `CLAIM_INCLUDE` ou select minimal (pas de `include: true` sur tout)

Report: checklist avec ✅/❌ et numéros de lignes pour les problèmes.
