**User Story :**
$ARGUMENTS

---

## Pipeline Complet — BA → Architecte → Design → Dev → Tests → Review

**Mission** : Orchestrer toute la chaîne d'industrialisation ClaimFlow AI depuis une User Story jusqu'à une MR prête à livrer.

---

Demander à l'utilisateur la User Story s'il ne l'a pas fournie.

Puis exécuter les étapes dans l'ordre **strict** suivant :

---

### Étape 1 — `/ba` : User Story → Specs

Appliquer le skill `/ba` sur la User Story fournie.
Produire : règles métier + Gherkin + cas limites + impacts données + JSON structuré.
Créer : `docs/features/<slug>/ba-specs.md`
**Résultat** : `specs.json` (en mémoire pour l'étape suivante)

---

### Étape 2 — `/architect` : Specs → Plan technique

Appliquer le skill `/architect` sur le JSON des specs.
Produire : contrats API + modèles Prisma + tâches par équipe + graphe de dépendances + DoD.
Créer : `docs/features/<slug>/architecture.md`
**Résultat** : Plan technique (en mémoire pour les étapes suivantes)

---

### Étape 3 — `/design` : Maquettes Stitch ⚠️ BLOQUANTE

**Cette étape est obligatoire avant tout développement frontend.**

Utiliser les outils MCP Stitch (`mcp__stitch__*`) pour :

1. **Vérifier** si un écran Stitch existe déjà pour cette feature :
   ```
   mcp__stitch__list_screens({ projectId: "projects/4597385239557674039" })
   ```

2. **Si l'écran n'existe pas** → le générer :
   ```
   mcp__stitch__generate_screen_from_text({
     projectId: "projects/4597385239557674039",
     prompt: "<description précise de l'écran basée sur les specs BA>",
     title: "<nom de l'écran>"
   })
   ```

3. **Si l'écran existe** → le récupérer pour référence :
   ```
   mcp__stitch__get_screen({ screenId: "<id>" })
   ```

4. **Enregistrer** le screen ID et le HTML de référence en mémoire pour l'étape `/frontend`.

**Design tokens imposés (toujours respecter) :**
- Fond : `#f8fafc` (slate-50)
- Primaire : `#4f46e5` (indigo-600)
- Accent : `#06b6d4` (cyan-500)
- Typo : Inter / Space Grotesk
- Style : Glassmorphism, soft shadows, badges colorés, moderne insurtech

**Résultat** : Screen ID Stitch + HTML de référence (transmis à `/frontend`)

---

### Étape 4 — Implémentation parallèle

Lancer `/backend` et `/ia` en parallèle (agents background).
**`/frontend`** démarre uniquement après réception des écrans Stitch de l'étape 3.

**`/backend`** : Prisma + validations Zod + routes API + services métier + audit trail
**`/frontend`** : Pages + composants fidèles aux écrans Stitch + intégration API
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
- Vérifier fidélité design vs écrans Stitch
- Générer le message de commit conventionnel
- Valider la checklist démo 15 min

---

### Output final

Résumé des fichiers créés/modifiés :
```
Créés   : X fichiers
Modifiés: X fichiers
Design  : Stitch screen ID + URL
Tests   : X/X verts — Coverage: X%
Commit  : "<type>(<scope>): <sujet>"
```

Instructions de démo :
1. `cd /c/projets/claims/claimflow && npm run dev`
2. Ouvrir http://localhost:3000
3. Se connecter avec marc@claimflow.ai / password123 (MANAGER)
4. Suivre le scénario de démo (15 min)
