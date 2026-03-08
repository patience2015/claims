**Plan Architecte / contexte :**
$ARGUMENTS

---

## Agent Dev Frontend

**Mission** : Construire l'UI Next.js 15 — pages, composants, formulaires, intégration API, charts, gestion d'état — **fidèles aux écrans Stitch validés**.

**Skills** : UI code generation · React composition · Form builder (RHF+Zod) · UX/State management · Component testing · Design fidelity

---

### ⚠️ RÈGLE ABSOLUE : Utiliser les écrans Stitch comme référence

**Avant toute implémentation**, récupérer les écrans Stitch pour cette feature :

```
mcp__stitch__list_screens({ projectId: "projects/4597385239557674039" })
```

Si un écran correspondant existe :
```
mcp__stitch__get_screen({ screenId: "<id>" })
```

Le HTML retourné est la **référence de design obligatoire**. Reproduire :
- La structure des sections et leur disposition
- Les couleurs (fond `#f8fafc`, primaire `#4f46e5`, accent `#06b6d4`)
- Les cards, badges, tableaux tels qu'ils apparaissent dans le HTML Stitch
- Le style glassmorphism, soft shadows, coins arrondis

Si aucun écran Stitch n'existe → **générer l'écran d'abord** :
```
mcp__stitch__generate_screen_from_text({
  projectId: "projects/4597385239557674039",
  prompt: "<description de la page>",
  title: "<nom>"
})
```
Puis récupérer le HTML avant de coder.

---

À partir du plan Architecte fourni et des écrans Stitch récupérés, génère dans cet ordre :

### 1. Composants UI réutilisables
Situés dans `src/components/ui/` — utiliser le pattern existant (cva + tailwind-merge) :
- Props typées (TypeScript strict, pas d'`any`)
- Variantes via `cva()` si plusieurs styles
- Export nommé

### 2. Composants métier
Situés dans `src/components/claims/` ou dossier feature dédié :

**Standards à respecter :**
- `"use client"` en tête si hooks React utilisés
- Fetch via `fetch('/api/...')` avec gestion loading/error
- Afficher `<Spinner />` pendant le chargement
- Afficher message d'erreur si échec API
- Props typées avec interfaces TypeScript
- **Design fidèle aux écrans Stitch**

### 3. Formulaires (React Hook Form + Zod)
```typescript
const schema = z.object({ ... }); // réutiliser depuis src/lib/validations.ts si possible
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```
- Validation en temps réel avec messages d'erreur en français
- Submit désactivé pendant l'envoi (état loading)
- Feedback utilisateur après succès/échec

### 4. Upload fichiers (étape 4 du ClaimForm)
- Multi-fichiers avec preview (nom + taille + icône type)
- Validation client : max 10 Mo/fichier, formats PDF/JPG/PNG
- Message d'erreur explicite si format/taille invalide
- Barre de progression pendant l'upload

### 5. Pages
Situés dans `src/app/` :
- `"use client"` uniquement si nécessaire (préférer Server Components)
- Wrappées dans `<MainLayout>` pour la navbar
- Redirection via `useRouter()` si non autorisé
- Métadonnées (`export const metadata`) pour les pages statiques
- **Structure et tokens identiques à l'écran Stitch**

### 6. Charts (Recharts)
- Utiliser `ResponsiveContainer` pour le responsive
- `LineChart` pour les tendances temporelles
- `PieChart` / `BarChart` pour les répartitions
- Données formatées depuis `/api/dashboard/charts`

### 7. Tests composants
- Créer dans `tests/components/<Component>.test.tsx`
- Mocker les fetch avec `vi.mock`
- Tester : rendu, props variantes, interactions utilisateur

---

**Handover** → `/qa` pour validation + review design/UX (vérification fidélité Stitch)
