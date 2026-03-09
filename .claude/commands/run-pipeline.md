**User Story :**
$ARGUMENTS

---

## Pipeline Complet — BA → Architecte → Design (Stitch) → Dev → Tests → Review

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

### Étape 3 — `/design` : Plan technique → Écrans Stitch ⚠️ OBLIGATOIRE

**Cette étape est bloquante — le frontend NE PEUT PAS démarrer sans elle.**

Utiliser les outils `mcp__stitch__*` pour :
1. Identifier les écrans existants dans le projet Stitch `projects/4597385239557674039`
2. Créer ou mettre à jour les écrans concernés par la feature
3. Récupérer le HTML de chaque écran via `mcp__stitch__get_screen_html`
4. Définir / confirmer les tokens design (couleurs, typo, espacements)

**Résultat** : HTML Stitch de référence + tokens design (en mémoire pour `/backend` et `/frontend`)

---

### Étape 4 — Implémentation parallèle

Lancer en parallèle (agents background) :

**`/backend`** : Prisma + validations Zod + routes API + services métier + audit trail
> ⚠️ Passer le HTML Stitch récupéré à l'étape 3 pour que le backend génère des réponses API cohérentes avec la structure attendue par les composants UI.

**`/frontend`** : Pages + composants + formulaires + charts + intégration API
> ⚠️ Le frontend DOIT utiliser le HTML Stitch de l'étape 3 comme référence de design. Fidélité pixel-perfect imposée.

**`/ia`** : Prompts + fonctions Claude + endpoints IA + orchestration /analyze

Attendre que les 3 soient terminés avant de passer à l'étape 5.

---

### Étape 5 — `/qa` : Tests & Qualité

Appliquer le skill `/qa` sur le code généré.
- Écrire les tests manquants (Vitest API + composants + E2E Playwright)
- Lancer `npm run test` — corriger jusqu'à tous verts
- Vérifier coverage ≥ 60%

---

### Étape 6 — `/review` : Revue & Commit

Appliquer le skill `/review` sur l'ensemble des fichiers modifiés.
- Corriger les problèmes critiques
- Vérifier la fidélité design vs écrans Stitch (étape 3)
- Générer le message de commit conventionnel
- Valider la checklist démo 15 min

---

### Output final

Résumé des fichiers créés/modifiés :
```
Créés   : X fichiers
Modifiés: X fichiers
Écrans Stitch : X créés/mis à jour
Tests   : X/X verts — Coverage: X%
Commit  : "<type>(<scope>): <sujet>"
```

Instructions de démo :
1. `cd /c/projets/claims/claimflow && npm run dev`
2. Ouvrir http://localhost:3000
3. Se connecter avec handler@claimflow.fr / handler123
4. Suivre le scénario de démo (15 min)
