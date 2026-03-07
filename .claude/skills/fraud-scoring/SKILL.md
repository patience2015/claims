---
name: fraud-scoring
description: >
  Connaissance complète du pipeline de scoring de fraude ClaimFlow basé sur Claude AI.
  Capacités :
  (1) Décrire le format JSON attendu en sortie du modèle IA,
  (2) Lister les facteurs de fraude et leurs poids,
  (3) Appliquer les règles métier (auto-approbation, escalade automatique),
  (4) Implémenter ou corriger la fonction analyzeFraud() dans ai-service.ts,
  (5) Corriger l'affichage du score dans FraudScoreCard.tsx.
  Déclencher quand l'utilisateur travaille sur la détection de fraude, le scoring IA,
  l'escalade automatique, ou l'affichage du score de fraude.
---

# Fraud Scoring — ClaimFlow

## Pipeline complet

```
Sinistre soumis
  → POST /api/ai/fraud { claimId }
  → analyzeFraud(claim) dans ai-service.ts
  → Claude claude-sonnet-4-6 (prompt structuré)
  → JSON { score, level, factors, recommendation }
  → Mise à jour Claim.fraudScore + Claim.fraudFlags
  → Règles métier (auto-approbation / escalade)
  → Affichage FraudScoreCard.tsx
```

## Format JSON attendu en sortie de Claude

```json
{
  "score": 45,
  "level": "MODERATE",
  "factors": [
    { "name": "Déclaration tardive", "weight": 15, "detected": true },
    { "name": "Description vague", "weight": 10, "detected": true },
    { "name": "Montant élevé sans justificatif", "weight": 20, "detected": false }
  ],
  "summary": "Score modéré — surveillance recommandée",
  "recommendation": "REVIEW"
}
```

**Important** : Claude doit retourner uniquement du JSON valide, aucun texte avant/après.
Utiliser `JSON.parse()` avec try/catch pour parser la réponse.

## Facteurs de fraude (poids en points)

| Facteur | Poids | Signal |
|---------|-------|--------|
| Déclaration > 30 jours après sinistre | +15 | `daysSinceIncident > 30` |
| Description < 50 mots ou vague | +10 | `description.split(' ').length < 50` |
| Sinistre le week-end entre 2h et 5h | +10 | Date/heure du sinistre |
| Plusieurs sinistres < 12 mois | +20 | Historique policyholder |
| Montant estimé > 90% valeur véhicule | +25 | Ratio estimation/valeur |
| Tiers impliqué sans plaque | +15 | `thirdPartyInvolved && !thirdPartyPlate` |
| Véhicule > 10 ans + THEFT | +10 | Corrélation type + année |

## Niveaux de risque

| Score | Niveau | Couleur | Badge |
|-------|--------|---------|-------|
| 0–29 | LOW | Vert `#22c55e` | `bg-green-100 text-green-800` |
| 30–59 | MODERATE | Jaune `#f59e0b` | `bg-yellow-100 text-yellow-800` |
| 60–79 | HIGH | Orange `#f97316` | `bg-orange-100 text-orange-800` |
| 80–100 | CRITICAL | Rouge `#ef4444` | `bg-red-100 text-red-800` |

## Règles métier (src/lib/claim-service.ts)

```typescript
// Auto-approbation
if (claim.estimatedAmount < 2000 && claim.fraudScore < 30) {
  await updateClaimStatus(claim.id, "APPROVED", "Auto-approbation : montant faible + score bas");
}

// Escalade automatique
if (claim.fraudScore > 70) {
  await updateClaimStatus(claim.id, "UNDER_REVIEW");
  await assignToManager(claim.id); // Assigner au manager disponible
}
```

## Prompt système pour Claude

```
Tu es un expert en détection de fraude pour les assurances automobiles.
Analyse ce sinistre et retourne UNIQUEMENT un JSON valide avec la structure suivante :
{ score: number (0-100), level: "LOW"|"MODERATE"|"HIGH"|"CRITICAL",
  factors: [{name, weight, detected}], summary: string, recommendation: string }
Ne retourne aucun texte en dehors du JSON.
```

## Fichiers concernés
- `src/lib/ai-service.ts` → `analyzeFraud()`
- `src/lib/claim-service.ts` → `checkFraudEscalation()`
- `src/app/api/ai/fraud/route.ts` → endpoint POST
- `src/components/claims/FraudScoreCard.tsx` → affichage
