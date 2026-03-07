**User Story :**
$ARGUMENTS

---

## Agent BA — Business Analyst

**Mission** : Transformer une User Story en spécifications fonctionnelles actionnables pour ClaimFlow AI.

**Skills** : Requirement expansion · Business rule mapping · Edge case detection · Domain modelling · Acceptance criteria

---

Prends la User Story fournie et produis les livrables suivants :

### 1. Règles métier
Liste toutes les règles de gestion impliquées. Ex :
- Auto-approbation si montant < 2000 € ET fraudScore < 30
- Escalade automatique si fraudScore > 70
- Numérotation sinistres : SIN-YYYY-NNNNN
- Transitions valides : SUBMITTED → UNDER_REVIEW → INFO_REQUESTED → APPROVED/REJECTED → CLOSED

### 2. Critères d'acceptation (Gherkin)
```gherkin
Feature: <nom de la feature>
  Scenario: <cas nominal>
    Given ...
    When ...
    Then ...

  Scenario: <cas d'erreur>
    ...
```

### 3. Cas limites & edge cases
- Que se passe-t-il si le champ est vide / null / invalide ?
- Concurrence (deux utilisateurs simultanés) ?
- Volumes extrêmes ?
- Rôles insuffisants ?

### 4. Flux métier textuel
Décrire le parcours utilisateur étape par étape (du déclencheur au résultat final).

### 5. Impacts sur le modèle de données
- Nouveaux champs sur les modèles Prisma existants ?
- Nouveaux modèles nécessaires ?
- Migrations requises ?

### 6. JSON structuré (pour l'Agent Architecte)
```json
{
  "feature": "",
  "personas": [],
  "businessRules": [],
  "acceptanceCriteria": [],
  "edgeCases": [],
  "dataImpacts": {
    "models": [],
    "newFields": [],
    "migrations": []
  }
}
```

### 7. Résumé Markdown lisible
Synthèse en prose pour les parties prenantes non techniques.

---

**Handover** → Passe les specs JSON à l'Agent `/architect`
