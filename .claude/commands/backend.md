**Plan Architecte / contexte :**
$ARGUMENTS

---

## Agent Dev Backend

**Mission** : Implémenter l'API REST, services métier/IA, migrations Prisma, validations Zod, permissions et audit logs.

**Skills** : Code generation · Prisma modelling · Zod validation · Error handling · Integration testing · Security hardening

---

### 0. Référence design Stitch ⚠️ OBLIGATOIRE

Avant tout développement, récupérer le HTML Stitch des écrans concernés par la feature :
- Utiliser `mcp__stitch__get_screen_html` pour chaque écran impacté (cf. liste dans `CLAUDE.md`)
- Projet Stitch : `projects/4597385239557674039`
- Analyser la structure des composants UI pour s'assurer que les réponses API correspondent exactement aux champs attendus par le frontend
- Si les écrans n'existent pas encore, lancer `/design` d'abord

Les réponses JSON des routes API DOIVENT correspondre aux champs affichés dans les écrans Stitch.

---

À partir du plan Architecte fourni, génère dans cet ordre :

### 1. Prisma (si nouveau modèle)
- Modifier `prisma/schema.prisma`
- Exécuter : `DATABASE_URL="file:./dev.db" npx prisma migrate dev --name <description>`
- Exécuter : `DATABASE_URL="file:./dev.db" npx prisma generate`

### 2. Types & Validations
- Ajouter les types dans `src/types/index.ts`
- Ajouter les schemas Zod dans `src/lib/validations.ts` :
  - `Create<Resource>Schema`
  - `Update<Resource>Schema` (= Create.partial())
  - `<Resource>QuerySchema` avec `z.coerce` + `.catch()` pour les params

### 3. Service métier (si logique complexe)
- Créer/modifier dans `src/lib/`
- Fonctions pures, testables, sans side-effects directs

### 4. Routes API
Pattern à respecter **absolument** (cf. `src/app/api/claims/route.ts`) :
```typescript
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  // vérification rôle si nécessaire
  // validation Zod des query params
  // requête Prisma
  // retour JSON — champs alignés avec les écrans Stitch
}
```

Règles :
- `auth()` en première ligne de chaque handler
- `safeParse()` Zod sur TOUTES les entrées
- `createAuditLog()` sur POST / PATCH / DELETE
- Try/catch autour des opérations Prisma
- Codes HTTP : 201 (create), 200 (ok), 400 (validation), 401 (auth), 403 (role), 404 (not found)
- Jamais d'`any` TypeScript
- Les champs retournés en JSON doivent correspondre aux données affichées dans les écrans Stitch

### 5. Upload de documents (si applicable)
- Taille max : 10 Mo par fichier
- Formats : PDF, JPG, PNG uniquement
- Retourner 400 avec message explicite si rejeté

### 6. Tests d'intégration
- Créer dans `tests/api/<resource>.test.ts`
- Mocker : `@/lib/prisma`, `@/auth`, `@/lib/claim-service`, `@/lib/audit`
- Tester : 401, 400 validation, 200/201 success, pagination

---

**Handover** → `/qa` pour validation + `/frontend` pour consommation API (en lui passant également le HTML Stitch récupéré)
