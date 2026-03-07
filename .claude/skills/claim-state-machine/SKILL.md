---
name: claim-state-machine
description: >
  Machine à états des sinistres ClaimFlow — transitions valides, règles métier associées et audit trail.
  Capacités :
  (1) Lister toutes les transitions de statut autorisées par rôle,
  (2) Implémenter ou valider une transition via VALID_TRANSITIONS,
  (3) Vérifier que createAuditLog() est appelé à chaque changement de statut,
  (4) Appliquer les règles d'auto-approbation et d'escalade fraude,
  (5) Corriger une transition refusée ou manquante.
  Déclencher quand l'utilisateur implémente un changement de statut de sinistre,
  demande les transitions autorisées, ou corrige une erreur de transition.
---

# Claim State Machine — ClaimFlow

## États possibles

```
SUBMITTED → UNDER_REVIEW → INFO_REQUESTED → APPROVED → CLOSED
                         ↘               ↗
                          REJECTED      → CLOSED
```

| Statut | Description | Acteur |
|--------|-------------|--------|
| `SUBMITTED` | Sinistre déposé, en attente | Système |
| `UNDER_REVIEW` | En cours d'analyse | HANDLER / MANAGER |
| `INFO_REQUESTED` | Informations manquantes demandées | HANDLER / MANAGER |
| `APPROVED` | Sinistre accepté | MANAGER / Système (auto) |
| `REJECTED` | Sinistre refusé | MANAGER |
| `CLOSED` | Dossier clos | MANAGER / ADMIN |

## Transitions valides (`src/types/index.ts`)

```typescript
export const VALID_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED:      ["UNDER_REVIEW"],
  UNDER_REVIEW:   ["INFO_REQUESTED", "APPROVED", "REJECTED"],
  INFO_REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  APPROVED:       ["CLOSED"],
  REJECTED:       ["CLOSED"],
  CLOSED:         [],
};
```

## Vérification avant transition

```typescript
function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// Dans la route PATCH /api/claims/[id]
if (!canTransition(claim.status, newStatus)) {
  return NextResponse.json(
    { error: `Transition ${claim.status} → ${newStatus} non autorisée` },
    { status: 400 }
  );
}
```

## Transitions par rôle

| Transition | HANDLER | MANAGER | ADMIN | Système |
|------------|---------|---------|-------|---------|
| SUBMITTED → UNDER_REVIEW | ✅ | ✅ | ✅ | ✅ |
| UNDER_REVIEW → INFO_REQUESTED | ✅ | ✅ | ✅ | — |
| UNDER_REVIEW → APPROVED | ❌ | ✅ | ✅ | ✅ (auto) |
| UNDER_REVIEW → REJECTED | ❌ | ✅ | ✅ | — |
| INFO_REQUESTED → UNDER_REVIEW | ✅ | ✅ | ✅ | — |
| * → CLOSED | ❌ | ✅ | ✅ | — |

## Audit trail obligatoire

```typescript
await createAuditLog({
  action: "STATUS_CHANGED",
  claimId: claim.id,
  userId: session.user.id,
  before: { status: claim.status },
  after:  { status: newStatus },
});
```

## Transitions automatiques (système)

### Auto-approbation
**Condition** : `estimatedAmount < 2000 && fraudScore < 30`
**Déclencheur** : après `POST /api/ai/analyze`
**Action** : `UNDER_REVIEW → APPROVED` avec note "Auto-approbation système"

### Escalade fraude
**Condition** : `fraudScore > 70`
**Déclencheur** : après calcul du fraudScore
**Action** : `SUBMITTED → UNDER_REVIEW` + assignation manager

## Fichiers concernés
- `src/types/index.ts` → `VALID_TRANSITIONS`, `ClaimStatus` enum
- `src/app/api/claims/[id]/route.ts` → handler PATCH (vérification transition)
- `src/lib/claim-service.ts` → `updateClaimStatus()`, `checkFraudEscalation()`
- `src/lib/audit.ts` → `createAuditLog()`
