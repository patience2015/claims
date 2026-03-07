**User Story :**
$ARGUMENTS

---

## Pipeline Complet — BA → Architecte → Dev → Tests → Review

**Mission** : Orchestrer toute la chaîne d'industrialisation ClaimFlow AI depuis une User Story jusqu'à une MR prête à livrer.

---

Demander à l'utilisateur la User Story s'il ne l'a pas fournie.

Puis exécuter les étapes dans l'ordre :

---

### Étape 1 — `/ba` : User Story → Specs

Appliquer le skill `/ba` sur la User Story fournie.
Produire : règles métier + Gherkin + cas limites + impacts données + JSON structuré.
**Résultat** : `specs.json` (en mémoire pour l'étape suivante)

---

### Étape 2 — `/architect` : Specs → Plan technique

Appliquer le skill `/architect` sur le JSON des specs.
Produire : contrats API + modèles Prisma + tâches par équipe + graphe de dépendances + DoD.
**Résultat** : Plan technique (en mémoire pour les étapes suivantes)

---

### Étape 3 — Implémentation parallèle

Lancer en parallèle (agents background) :

**`/backend`** : Prisma + validations Zod + routes API + services métier + audit trail
**`/frontend`** : Pages + composants + formulaires + charts + intégration API
**`/ia`** : Prompts + fonctions Claude + endpoints IA + orchestration /analyze

Attendre que les 3 soient terminés avant de passer à l'étape 4.

---

### Étape 4 — `/qa` : Tests & Qualité

Appliquer le skill `/qa` sur le code généré.
- Écrire les tests manquants (Vitest API + composants + E2E Playwright)
- Lancer `npm run test` — corriger jusqu'à tous verts
- Vérifier coverage ≥ 60%

---

### Étape 5 — `/review` : Revue & Commit

Appliquer le skill `/review` sur l'ensemble des fichiers modifiés.
- Corriger les problèmes critiques
- Générer le message de commit conventionnel
- Valider la checklist démo 15 min

---

### Output final

Résumé des fichiers créés/modifiés :
```
Créés   : X fichiers
Modifiés: X fichiers
Tests   : X/X verts — Coverage: X%
Commit  : "<type>(<scope>): <sujet>"
```

Instructions de démo :
1. `cd /c/projets/claims/claimflow && npm run dev`
2. Ouvrir http://localhost:3000
3. Se connecter avec handler@claimflow.fr / handler123
4. Suivre le scénario de démo (15 min)
