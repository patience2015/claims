**Specs BA à architecturer :**
$ARGUMENTS

---

## Agent Architecte — Orchestration Technique

**Mission** : Convertir les specs BA en architecture complète + plan d'implémentation pour ClaimFlow AI.

**Skills** : System design · API modelling · Prisma schema design · Dependency graph building · Technical planning

---

À partir des specs BA fournies, produis :

### 1. Architecture cible
- Modules impactés dans `src/` (api routes, lib services, components, pages)
- Nouveaux fichiers à créer vs fichiers existants à modifier
- Dépendances entre modules

### 2. Contrats API
Pour chaque endpoint :
```
METHOD /api/resource
Auth: HANDLER | MANAGER | ADMIN | PUBLIC
Input (Zod): { ... }
Output 200/201: { ... }
Errors: 400 | 401 | 403 | 404 | 500
Audit: OUI/NON (action: ...)
```

### 3. Mises à jour Prisma
```prisma
// Modèles à ajouter ou modifier
model Example {
  id        String   @id @default(cuid())
  // champs...
  createdAt DateTime @default(now())
}
```
Indiquer les migrations nécessaires.

### 4. Tâches par équipe
```
Backend:
  - [ ] Tâche 1 (fichier: src/app/api/...)
  - [ ] Tâche 2 (fichier: src/lib/...)

Frontend:
  - [ ] Tâche 1 (fichier: src/app/...)
  - [ ] Tâche 2 (fichier: src/components/...)

IA:
  - [ ] Tâche 1 (prompt + endpoint)

QA:
  - [ ] Tests à écrire
```

### 5. Graphe de dépendances
Ordre d'implémentation recommandé (quoi faire en premier pour débloquer le reste).

### 6. Definition of Done (DoD)
- [ ] Tests unitaires verts (Vitest)
- [ ] Tests E2E verts (Playwright)
- [ ] Coverage ≥ 60%
- [ ] Critères d'acceptation Gherkin vérifiés
- [ ] Audit logs complets sur toutes les mutations
- [ ] TypeScript strict (zéro `any`)
- [ ] Zod sur 100% des entrées API

---

**Handover** → `/backend` + `/frontend` + `/ia` + `/qa` (en parallèle)
