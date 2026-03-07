---
name: api-route-guard
description: >
  Vérifie et applique les conventions obligatoires des routes API ClaimFlow.
  Capacités :
  (1) Vérifier la présence de auth() en première instruction,
  (2) Vérifier la validation Zod sur toutes les entrées (query params et body),
  (3) Vérifier createAuditLog() sur toutes les mutations POST/PATCH/DELETE,
  (4) Vérifier les codes HTTP corrects (201 POST, 400 validation, 401 auth, 403 rôle, 404 not found),
  (5) Scaffolder une route manquante avec toutes les conventions pré-remplies.
  Déclencher quand l'utilisateur crée, modifie ou demande un audit d'une route API ClaimFlow
  (fichiers src/app/api/**/route.ts), ou quand une route ne respecte pas les conventions du projet.
---

# API Route Guard — ClaimFlow

## Conventions obligatoires

Chaque handler (`GET`, `POST`, `PATCH`, `DELETE`) dans un fichier `route.ts` doit respecter **dans l'ordre** :

### 1. Auth en première ligne
```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
```

### 2. Vérification du rôle (si restreint)
```typescript
if (!["MANAGER", "ADMIN"].includes(session.user.role)) {
  return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
}
```

### 3. Validation Zod
- **GET** : `QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))`
- **POST/PATCH** : `BodySchema.safeParse(await request.json())`
- Retourner `400` avec `{ error: "Validation échouée", details: result.error.flatten() }` si échec

### 4. Opération Prisma (dans try/catch)
```typescript
try {
  const data = await prisma.claim.findMany({ ... });
  return NextResponse.json({ data });
} catch (error) {
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}
```

### 5. Audit log (sur toutes les mutations)
```typescript
await createAuditLog({
  action: "CLAIM_CREATED",       // ou STATUS_CHANGED, DOCUMENT_UPLOADED, etc.
  claimId: claim.id,
  userId: session.user.id,
  after: claim,
});
```

## Codes HTTP
| Code | Quand |
|------|-------|
| 200 | GET réussi |
| 201 | POST réussi (création) |
| 400 | Validation Zod échouée |
| 401 | Session nulle |
| 403 | Rôle insuffisant |
| 404 | Ressource introuvable |
| 500 | Erreur Prisma ou serveur |

## Checklist d'audit rapide
- [ ] `auth()` → première instruction de chaque handler
- [ ] `safeParse()` → sur query params ET body
- [ ] `createAuditLog()` → sur POST, PATCH, DELETE
- [ ] Aucun `any` TypeScript
- [ ] `try/catch` autour de chaque opération Prisma
- [ ] Pas de données sensibles (pas de `password` dans la réponse)
- [ ] `select` minimal (pas de `include: true` tout court)

## Imports standard à inclure
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
```
