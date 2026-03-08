**Plan Architecte / règles métier / contexte :**
$ARGUMENTS

---

## Agent IA Engineer

**Mission** : Prompts système, Agent Teams (extraction/fraude/estimation/courrier), endpoints IA, orchestration `/api/claims/:id/analyze`.

**Skills** : Prompt engineering · Agent Teams · JSON schema enforcing · Orchestration · Hooks qualité

---

### 1. Modèle IA
**Toujours utiliser** : `claude-sonnet-4-6`
Fichier cible : `src/lib/ai-service.ts`

### 2. Structure de chaque fonction IA
```typescript
export async function <functionName>(input: <InputType>): Promise<<OutputType>> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: <adapté>,
    system: `<prompt système>`,
    messages: [{ role: "user", content: <prompt utilisateur avec données> }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Parser le JSON — lever une erreur si malformé
  const result = JSON.parse(text);
  // Valider avec Zod si schéma disponible
  return result;
}
```

### 3. Les 4 fonctions à implémenter

#### `extractClaimInfo(claim)` → ExtractionResult
Prompt : extraire type, date, lieu, parties impliquées, véhicules, circonstances depuis la description libre.
Sortie JSON :
```json
{ "type": "COLLISION", "incidentDate": "...", "location": "...", "parties": [], "vehicles": [], "circumstances": "..." }
```

#### `analyzeFraud(claim)` → FraudResult
Prompt : analyser les facteurs de fraude avec poids.
Sortie JSON :
```json
{ "score": 0-100, "risk": "LOW|MODERATE|HIGH|CRITICAL", "factors": [{ "name": "", "description": "", "weight": 0, "detected": true }], "summary": "", "recommendation": "" }
```
Seuils : LOW < 30 · MODERATE 30-59 · HIGH 60-79 · CRITICAL ≥ 80

#### `estimateIndemnization(claim)` → EstimationResult
Prompt : estimer les montants en utilisant les barèmes standard (sinistres auto France).
Sortie JSON :
```json
{ "minimum": 0, "probable": 0, "maximum": 0, "breakdown": [{ "item": "", "amount": 0 }], "methodology": "" }
```

#### `generateLetter(claim, type)` → LetterResult
Types : ACKNOWLEDGMENT · DOCUMENT_REQUEST · APPROVAL · REJECTION · INFO_REQUEST
Sortie JSON :
```json
{ "subject": "", "body": "", "type": "...", "generatedAt": "..." }
```

### 4. Orchestration `POST /api/claims/:id/analyze`
Lancer les 3 analyses en parallèle (extraction + fraude + estimation) :
```typescript
const [extraction, fraud, estimation] = await Promise.all([
  extractClaimInfo(claim),
  analyzeFraud(claim),
  estimateIndemnization(claim),
]);
```
Puis générer le courrier adapté au niveau de fraude.
Sauvegarder chaque résultat dans `AIAnalysis` (Prisma).
Déclencher `checkFraudEscalation()` si score > 70.

### 5. Hooks qualité JSON
- Toujours parser dans un try/catch
- Si JSON malformé → retourner une erreur 422 avec le texte brut pour debug
- Logger les tokens consommés dans `AIAnalysis.tokensUsed`
- Logger la durée dans `AIAnalysis.durationMs`

### 6. Endpoints IA individuels
- `POST /api/ai/extract` — `src/app/api/ai/extract/route.ts`
- `POST /api/ai/fraud` — `src/app/api/ai/fraud/route.ts`
- `POST /api/ai/estimate` — `src/app/api/ai/estimate/route.ts`
- `POST /api/ai/letter` — `src/app/api/ai/letter/route.ts`

Chaque endpoint : auth + Zod + appel service + sauvegarde AIAnalysis.

---

**Handover** → `/frontend` (affichage AIAnalysisPanel, FraudScoreCard, EstimationCard, LetterGenerator) + `/backend` (persistence AIAnalysis)
