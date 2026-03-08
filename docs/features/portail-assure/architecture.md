# Architecture & Plan d'Implémentation — Portail Assuré Self-Service

**Feature :** `portail-assure-self-service`
**Version :** 1.0
**Date :** Mars 2026
**Statut :** Implémenté ✅

---

## 1. Modules impactés

```
src/
├── app/
│   ├── portail/
│   │   ├── layout.tsx                          ← CRÉÉ  : header + déconnexion portail
│   │   ├── login/
│   │   │   └── page.tsx                        ← CRÉÉ  : auth policyNumber+email
│   │   └── mes-sinistres/
│   │       ├── page.tsx                        ← CRÉÉ  : liste sinistres assuré
│   │       └── [id]/
│   │           └── page.tsx                    ← CRÉÉ  : détail + upload + décision
│   └── api/
│       └── portail/
│           ├── claims/
│           │   ├── route.ts                    ← CRÉÉ  : GET liste
│           │   └── [id]/
│           │       ├── route.ts                ← CRÉÉ  : GET détail
│           │       ├── documents/
│           │       │   └── route.ts            ← CRÉÉ  : POST upload
│           │       └── decision/
│           │           └── route.ts            ← CRÉÉ  : POST accept/refus
├── auth.ts                                     ← MODIFIÉ : provider "policyholder"
├── middleware.ts                               ← MODIFIÉ : routing POLICYHOLDER
└── lib/
    ├── email-service.ts                        ← CRÉÉ  : service email async
    └── permissions.ts                          ← MODIFIÉ : getDefaultRedirect POLICYHOLDER

prisma/
├── schema.prisma                               ← MODIFIÉ : userId, closureReason, EmailNotification
└── migrations/
    └── 20260308053124_add_policyholder_portal/ ← CRÉÉ  : migration appliquée

types/
└── index.ts                                   ← MODIFIÉ : UserRole + AuditAction

tests/
└── api/portail/
    ├── claims.test.ts                          ← CRÉÉ  : 7 tests GET liste
    ├── claims-id.test.ts                       ← CRÉÉ  : 11 tests GET détail
    └── decision.test.ts                        ← CRÉÉ  : 12 tests POST décision
```

---

## 2. Contrats API

### GET /api/portail/claims
```
Auth: POLICYHOLDER uniquement
Input: aucun (policyholderID extrait du JWT)
Output 200:
  {
    data: [
      {
        id: string
        claimNumber: string
        status: ClaimStatus
        type: ClaimType
        incidentDate: string
        incidentLocation: string
        estimatedAmount: number | null
        approvedAmount: number | null
        createdAt: string
      }
    ]
  }
Errors:
  401 — Non authentifié
  403 — Rôle != POLICYHOLDER
  404 — policyholderID absent du JWT
  500 — Erreur serveur
Audit: NON (lecture seule)
Filtre: WHERE policyholderID = session.policyholderID
Tri: ORDER BY createdAt DESC
```

### GET /api/portail/claims/[id]
```
Auth: POLICYHOLDER uniquement
Input: id (URL param)
Output 200:
  {
    data: {
      ...ClaimDetail,
      documents: DocumentItem[],
      canUpload: boolean,   // status in [SUBMITTED, UNDER_REVIEW, INFO_REQUESTED]
      canDecide: boolean    // status == APPROVED && approvedAmount != null
    }
  }
Errors:
  401 — Non authentifié
  403 — Rôle != POLICYHOLDER | claim.policyholderID != session.policyholderID
  404 — Sinistre inexistant
  500 — Erreur serveur
Audit: NON (lecture seule)
```

### POST /api/portail/claims/[id]/documents
```
Auth: POLICYHOLDER uniquement
Input: FormData { file: File }
Contraintes:
  - mimeType in [application/pdf, image/jpeg, image/png]
  - size <= 5 * 1024 * 1024 (5 Mo)
  - claim.status in [SUBMITTED, UNDER_REVIEW, INFO_REQUESTED]
  - claim.policyholderID == session.policyholderID
Output 201: { data: Document }
Errors:
  400 — Fichier manquant | format invalide | taille dépassée | statut non éligible
  401 — Non authentifié
  403 — Propriété sinistre
  404 — Sinistre inexistant
  500 — Erreur serveur
Audit: OUI — action: DOCUMENT_UPLOADED_BY_POLICYHOLDER
Stockage: uploads/[claimId]/[timestamp]-[filename]
```

### POST /api/portail/claims/[id]/decision
```
Auth: POLICYHOLDER uniquement
Input (Zod union):
  { decision: "ACCEPT" }
  | { decision: "REJECT", reason: string (min 20 chars) }
Contraintes:
  - claim.status == "APPROVED"
  - claim.policyholderID == policyholder.id (lookup par userId)
Output 200: { data: { id, status: "CLOSED", closureReason } }
Errors:
  400 — Données invalides | statut != APPROVED
  401 — Non authentifié
  403 — Rôle | propriété sinistre
  404 — Policyholder introuvable | sinistre inexistant
  500 — Erreur serveur
Audit: OUI — action: STATUS_CHANGED
closureReason:
  ACCEPT → "Proposition acceptée par l'assuré"
  REJECT → "Proposition refusée par l'assuré : {reason}"
```

---

## 3. Mises à jour Prisma

```prisma
// Modèle Policyholder — ajout liaison User
model Policyholder {
  // ... champs existants ...
  userId  String?  @unique                                    // ← NOUVEAU
  user    User?    @relation("UserPolicyholder",              // ← NOUVEAU
                    fields: [userId], references: [id])
}

// Modèle Claim — ajout motif de clôture
model Claim {
  // ... champs existants ...
  closureReason  String?                                      // ← NOUVEAU
}

// Nouveau modèle
model EmailNotification {
  id        String    @id @default(cuid())
  claimId   String
  claim     Claim     @relation(fields: [claimId],
                        references: [id], onDelete: Cascade)
  to        String
  subject   String
  body      String
  sentAt    DateTime?
  error     String?
  createdAt DateTime  @default(now())
}
```

**Migration :** `20260308053124_add_policyholder_portal` — appliquée ✅

---

## 4. Authentification — Provider NextAuth

```typescript
// src/auth.ts — provider "policyholder"
Credentials({
  id: "policyholder",
  credentials: { policyNumber, email },
  async authorize(credentials) {
    // 1. Valider policyNumber + email (Zod)
    // 2. Lookup Policyholder WHERE policyNumber AND email
    // 3. Si non trouvé → null (connexion échouée)
    // 4. Si trouvé → récupérer ou créer User { role: POLICYHOLDER }
    //    via policyholderProfile: { connect: { id: ph.id } }
    // 5. Retourner { id, email, name, role: "POLICYHOLDER", policyholderID: ph.id }
  }
})

// JWT callback — champs supplémentaires
token.policyholderID = user.policyholderID
token.exp = now + 4h  // si provider === "policyholder"
```

---

## 5. Middleware — Routing POLICYHOLDER

```typescript
// src/middleware.ts
// POLICYHOLDER : accès limité à /portail/* et /api/portail/*
if (userRole === "POLICYHOLDER") {
  if (!pathname.startsWith("/portail") && !pathname.startsWith("/api/portail")) {
    return redirect("/portail/mes-sinistres")
  }
  return next()
}

// getDefaultRedirect("POLICYHOLDER") → "/portail/mes-sinistres"
```

---

## 6. Graphe de dépendances (ordre d'implémentation)

```
1. schema.prisma                  → base de tout
      ↓
2. npx prisma migrate dev         → types Prisma régénérés
      ↓
3. types/index.ts                 → UserRole + AuditAction mis à jour
      ↓
4. auth.ts                        → provider "policyholder" + JWT callbacks
      ↓
5. middleware.ts                  → routing POLICYHOLDER
      ↓
6. lib/permissions.ts             → getDefaultRedirect POLICYHOLDER
      ↓
7. API routes (parallèle)
   ├── /api/portail/claims
   ├── /api/portail/claims/[id]
   ├── /api/portail/claims/[id]/documents
   └── /api/portail/claims/[id]/decision
      ↓
8. Pages frontend (parallèle)
   ├── portail/layout.tsx
   ├── portail/login/page.tsx
   ├── portail/mes-sinistres/page.tsx
   └── portail/mes-sinistres/[id]/page.tsx
      ↓
9. Tests unitaires (30 tests)
      ↓
10. Commit + Push
```

---

## 7. Tâches par équipe

### Backend
- [x] Migration Prisma `add_policyholder_portal`
- [x] Provider `policyholder` dans `auth.ts`
- [x] Middleware routing POLICYHOLDER
- [x] `GET /api/portail/claims` — liste filtrée par policyholderID
- [x] `GET /api/portail/claims/[id]` — détail + canUpload + canDecide
- [x] `POST /api/portail/claims/[id]/documents` — upload fichier
- [x] `POST /api/portail/claims/[id]/decision` — accept/refus + audit
- [x] `lib/email-service.ts` — service email async (base pour notifications)

### Frontend
- [x] `portail/layout.tsx` — header portail + bouton déconnexion
- [x] `portail/login/page.tsx` — formulaire + comptes démo cliquables
- [x] `portail/mes-sinistres/page.tsx` — liste sinistres avec badge statut
- [x] `portail/mes-sinistres/[id]/page.tsx` — détail + upload + section décision

### Tests
- [x] `tests/api/portail/claims.test.ts` (7 tests)
- [x] `tests/api/portail/claims-id.test.ts` (11 tests)
- [x] `tests/api/portail/decision.test.ts` (12 tests)
- [ ] Tests E2E Playwright (à faire)

---

## 8. Definition of Done

- [x] 30/30 tests unitaires verts
- [x] TypeScript strict — zéro `any`
- [x] Zod sur 100% des entrées API
- [x] Audit trail sur toutes les mutations (upload + décision)
- [x] Isolation données POLICYHOLDER vérifiée (ownership check)
- [x] Score de fraude non exposé côté portail
- [x] Migration Prisma appliquée
- [x] Commit conventionnel pushé
- [ ] Tests E2E Playwright (différé)
- [ ] Coverage ≥ 60% global (à vérifier après ajout e2e)

---

## 9. Points d'attention pour la maintenance

1. **`prisma generate` obligatoire** après toute migration — le client Prisma doit être regénéré avant de démarrer le serveur.
2. **Relation `Policyholder ↔ User`** — la FK est sur `Policyholder.userId` (côté Policyholder). Le User est créé dynamiquement à la première connexion.
3. **`EmailNotification`** — table créée mais le service d'envoi réel (nodemailer) est un stub. À brancher sur les webhooks de changement de statut dans la feature P1 Notifications.
4. **Upload files** — stockés dans `uploads/[claimId]/` sur le filesystem local. En production, remplacer par S3/Cloudflare R2.
