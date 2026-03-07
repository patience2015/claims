**Contexte / demande MCP :**
$ARGUMENTS

---

## MCP — Serveurs disponibles dans ClaimFlow

ClaimFlow utilise **deux serveurs MCP** : un pour les barèmes d'indemnisation, un pour l'automatisation navigateur via Playwright.

---

### 1. MCP Barèmes — `baremes-server`

Serveur local exposant les barèmes d'indemnisation automobile.

**Lancer le serveur :**
```bash
cd /c/projets/claims/claimflow && npx ts-node mcp/baremes-server.ts
```

**Fichier source :** `mcp/baremes-server.ts`

**3 outils exposés :**

| Outil | Entrée | Sortie |
|-------|--------|--------|
| `get_bareme` | `{ type: ClaimType }` | `{ minAmount, maxAmount, averageAmount, coverageItems, deductibles }` |
| `estimate_indemnization` | `{ type, damageLevel, vehicleValue, hasThirdParty }` | `{ estimatedAmount, breakdown, methodology, confidence }` |
| `list_claim_types` | `{}` | `{ types: [{ value, label, description, avgProcessingDays }] }` |

**Intégration IA :** Les barèmes sont injectés en contexte système dans `src/lib/ai-service.ts` pour `analyzeFraud()` et `estimateIndemnization()`.

**Évolution possible :** Ajouter `get_weather_at_incident` (date + lieu → conditions météo) pour croiser avec la détection de fraude.

---

### 2. MCP Playwright — `playwright`

Automatisation navigateur pour les tests E2E et la vérification de scénarios en conditions réelles.

**Configuration :** `.mcp.json` à la racine du projet (chargé automatiquement par Claude Code).

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Outils disponibles une fois le MCP chargé :**
- `browser_navigate` — Naviguer vers une URL
- `browser_click` — Cliquer sur un sélecteur
- `browser_fill` — Remplir un champ
- `browser_screenshot` — Capturer l'écran courant
- `browser_evaluate` — Exécuter du JavaScript dans la page
- `browser_wait_for_selector` — Attendre qu'un élément soit visible

**Comptes de test :**
| Rôle | Email | Mot de passe | Redirection |
|------|-------|-------------|-------------|
| Gestionnaire | julie@claimflow.ai | password123 | /claims |
| Manager | marc@claimflow.ai | password123 | /dashboard |
| Admin | thomas@claimflow.ai | password123 | /admin |

**Usage typique :**
```
→ browser_navigate http://localhost:3000/login
→ browser_fill [name="email"] julie@claimflow.ai
→ browser_fill [name="password"] password123
→ browser_click [type="submit"]
→ browser_screenshot
```

**Note :** Pour les tests E2E automatisés, préférer `/e2e` (Playwright CLI). Le MCP Playwright est utile pour l'exploration interactive et le débogage visuel.

---

**Handover :** `/ia` (barèmes dans prompts) · `/e2e` (tests automatisés) · `/frontend` (affichage EstimationCard)
