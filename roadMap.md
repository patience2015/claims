# ClaimFlow AI — Roadmap Produit v2.0

> **Vision rechallengée** : ClaimFlow n'est pas un outil de gestion des sinistres. C'est une **plateforme d'intelligence sinistres** — le moteur IA qui va absorber 80% des décisions humaines sur les sinistres automobiles et devenir le SaaS de référence pour les assureurs européens.
>
> L'ancienne roadmap pensait "feature". La nouvelle pense "disruption".

---

## Ce qui existe déjà ✅

| Domaine | Couverture |
|---------|-----------|
| Auth 3 rôles + JWT | ✅ Complet |
| CRUD sinistres + workflow statuts | ✅ Complet |
| Upload documents | ✅ Complet |
| Analyse IA (extraction + fraude + estimation) | ✅ Complet |
| Génération + envoi courriers | ✅ Complet |
| Dashboard KPIs + graphiques | ✅ Complet |
| Audit trail | ✅ Complet |
| Admin utilisateurs + export CSV | ✅ Complet |
| Auto-approbation + escalade fraude | ✅ Complet |
| Commentaires internes | ✅ Complet |
| Notifications in-app + email + SLA | ✅ Complet |
| Portail assuré self-service | ✅ Complet |
| Dashboard Équipe Manager + bulk assign | ✅ Complet |

---

## Thèse ambitieuse — Pourquoi cette roadmap

L'assurance automobile génère **85 milliards € de sinistres/an en Europe**. 30% sont frauduleux ou surestimés. Aujourd'hui, chaque gestionnaire traite 150 dossiers avec Word, Excel et des emails. Le coût de traitement d'un sinistre est de **320€ en moyenne** — dont 70% est du temps humain.

ClaimFlow peut :
1. **Absorber la décision automatique** sur 60% des sinistres simples (< 2 000€, fraude nulle)
2. **Détecter la fraude en réseau** (rings, récidivistes, faux experts) — impossible manuellement
3. **Devenir la plateforme SaaS** que louent 50 assureurs plutôt qu'une app interne

**Cible dans 18 mois** : 500k sinistres/an traités, 3 clients assureurs en prod, 40% de réduction du coût sinistre.

---

## PHASE 1 — Intelligence Augmentée (M1–M3)
*Transformer l'IA d'un assistant en décideur autonome*

---

### 🔴 P1-A — Agents IA Autonomes (Claims Autopilot)

**Disruption** : Aujourd'hui l'IA analyse et recommande. Demain, l'IA *agit* — et le gestionnaire ne supervise que les cas complexes.

**Ce que ça change :**
- L'IA peut clôturer automatiquement les sinistres mineurs sans action humaine
- L'IA envoie les courriers, demande les documents manquants, relance l'assuré
- Le gestionnaire est notifié uniquement si l'IA est bloquée ou si le score de confiance est < 80%

**Architecture — Agents Claude (claude-sonnet-4-6) :**
```
Agent Orchestrateur
├── Agent Triage       → Classifie + priorise à l'arrivée
├── Agent Instruction  → Demande les pièces manquantes
├── Agent Investigation → Corrèle avec la base historique
├── Agent Décision     → Propose approbation/rejet avec justification
└── Agent Communication → Rédige et envoie les courriers
```

**Métriques cibles :**
- 60% des sinistres < 2 000€ traités sans intervention humaine
- Délai moyen : 48h → 4h sur les dossiers automatisés

**Commande :**
```bash
/run-pipeline "Claims Autopilot : agent orchestrateur Claude avec 5 sous-agents (triage, instruction, investigation, décision, communication), table AgentRun avec logs actions, tableau de bord supervision humaine, seuil de confiance configurable avant action autonome"
```

---

### 🔴 P1-B — Analyse Visuelle IA (Computer Vision)

**Disruption** : Les photos sont uploadées mais jamais lues. Claude Vision peut estimer les dégâts avec une précision de ±15% — mieux que certains experts humains sur les sinistres légers.

**Ce que ça change :**
- Estimation automatique depuis les photos en < 30 secondes
- Détection de dégâts pré-existants vs récents (analyse comparative si historique)
- Détection de mise en scène (angles impossibles, dégâts incohérents)
- Confirmation ou contestation de l'estimation du réparateur

**Pipeline Vision :**
```
Photos → Base64 → Claude Vision (claude-sonnet-4-6)
  ├── Description structurée des dégâts
  ├── Zone touchée (avant/arrière/côté/toit)
  ├── Gravité estimée (MINOR/MODERATE/SEVERE/TOTAL_LOSS)
  ├── Cohérence avec déclaration (score 0-100)
  └── Flags suspects (retouche, dégâts anciens, incohérence)
```

**Commande :**
```bash
/run-pipeline "Analyse photos Claude Vision : endpoint /api/ai/analyze-images, envoi base64 JPG/PNG/WebP, prompt structuré dégâts automobiles, résultat JSON (zone, gravité, cohérence, flags), intégration dans AIAnalysisPanel, comparaison estimation visuelle vs déclaration"
```

---

### 🔴 P1-C — Détection de Fraude en Réseau

**Disruption** : La fraude isolée (1 assuré, 1 sinistre) est détectable. La fraude organisée (réseaux de garages, experts complices, récidivistes multi-assureurs) est **invisible** avec une analyse dossier par dossier.

**Ce que ça change :**
- Détection des anneaux de fraude : même garage + même expert + mêmes pièces = réseau
- Corrélation temporelle : 3 sinistres sur le même carrefour en 2 mois = fraude organisée
- Score de risque réseau : un assuré est évalué sur ses connexions, pas que sur ses dossiers

**Graphe de fraude :**
```
Nœuds  : Assuré, Véhicule, Garage, Expert, Témoin, Lieu
Arêtes : "déclaré à", "réparé par", "expertisé par", "témoin de"
Score  : Centralité dans le réseau × Fréquence × Montant cumulé
```

**Nouvelles tables Prisma :**
- `FraudNetwork` — entités suspectes avec score réseau
- `FraudLink` — relations entre entités
- `FraudAlert` — alertes multi-dossiers avec preuve

**Commande :**
```bash
/run-pipeline "Fraude réseau : algorithme de graphe (assurés/garages/experts/lieux), détection clusters suspects, table FraudNetwork + FraudLink, score réseau injecté dans analyzeFraud(), page MANAGER 'Réseaux suspects' avec visualisation graphe D3.js"
```

---

### 🟠 P1-D — Estimation Prédictive par ML

**Au-delà des barèmes** : Les barèmes donnent une fourchette. L'IA peut prédire le montant *réel* final en apprenant des milliers de dossiers historiques.

**Ce que ça change :**
- Modèle prédictif entraîné sur l'historique des sinistres ClaimFlow
- Facteurs : type, gravité, véhicule, âge assuré, saison, région, garage
- Précision cible : ±8% sur les sinistres standard (vs ±25% avec les barèmes)
- Détection des devis gonflés : si le devis dépasse 2σ du modèle → flag automatique

**Commande :**
```bash
/run-pipeline "Estimation ML : endpoint /api/ai/predict-amount avec régression sur historique sinistres, facteurs véhicule/type/région/saison, intervalle de confiance 90%, flag automatique si devis hors intervalle, affichage prédiction vs barème dans EstimationCard"
```

---

## PHASE 2 — Plateforme & Écosystème (M4–M8)
*De l'application interne au SaaS multi-tenant*

---

### 🔴 P2-A — Architecture Multi-Tenant SaaS

**Disruption** : ClaimFlow n'est plus l'outil interne d'un assureur — c'est le SaaS que louent 50 assureurs.

**Ce que ça change :**
- Isolation complète des données par tenant (assureur)
- Configuration par tenant : logo, barèmes, seuils, workflows
- Facturation usage-based : X€ par sinistre traité
- Onboarding self-service : un assureur peut configurer son espace en < 2h

**Architecture :**
```
Tenant A (AXA)       → schéma PostgreSQL isolé + config propre
Tenant B (MAIF)      → schéma PostgreSQL isolé + config propre
Tenant C (Allianz)   → schéma PostgreSQL isolé + config propre
        ↕
ClaimFlow Core API   → middleware tenant detection (subdomain ou header)
        ↕
IA partagée          → prompts + modèles partagés (aucune donnée cross-tenant)
```

**Commande :**
```bash
/run-pipeline "Multi-tenant : middleware tenant detection par subdomain/header, isolation DB via prisma row-level security ou schémas séparés, table Tenant (nom, config JSON, plan, facturation), onboarding wizard admin, page super-admin cross-tenant analytics"
```

---

### 🟠 P2-B — API Publique & Webhooks (Insurance as a Platform)

**Disruption** : Les assureurs veulent intégrer ClaimFlow dans leur SI existant — pas remplacer leur CRM. Une API publique fait de ClaimFlow une brique d'intelligence, pas une app isolée.

**Cas d'usage :**
- Un assureur déclenche une analyse fraude depuis son CRM legacy
- Un concessionnaire crée automatiquement un sinistre depuis son logiciel
- Un broker reçoit un webhook à chaque changement de statut
- Une app mobile tierce affiche le statut en temps réel

**Ce qu'on expose :**
```
POST /api/v1/claims              ← Créer un sinistre
GET  /api/v1/claims/:id          ← Lire un dossier
POST /api/v1/claims/:id/analyze  ← Déclencher l'analyse IA
GET  /api/v1/analytics/fraud     ← Stats fraude agrégées
POST /api/v1/webhooks            ← S'abonner aux événements

Authentification : API Key + HMAC signature
Rate limiting : 1000 req/min par client
SDK : npm package @claimflow/sdk
```

**Commande :**
```bash
/run-pipeline "API publique v1 : versioning /api/v1, API Keys avec table ApiKey (hash, scopes, rateLimit), middleware rate limiting, webhooks (table WebhookEndpoint + livraison async avec retry), documentation OpenAPI auto-générée, SDK npm @claimflow/sdk"
```

---

### 🟠 P2-C — Marketplace Partenaires

**Disruption** : Le dossier sinistre est un hub d'interactions avec des tiers — réparateurs, experts, avocats, médecins. Les intégrer dans la plateforme crée un réseau à effet de levier.

**Acteurs du marketplace :**
| Partenaire | Ce qu'ils font | Valeur pour ClaimFlow |
|-----------|---------------|----------------------|
| Garages agréés | Uploader devis + photos directement | Moins de délais, données structurées |
| Experts auto | Rapport d'expertise directement dans le dossier | Workflow intégré, zéro email |
| Avocats | Accès dossier avec permissions limitées | Nouveau segment client |
| Loueurs | Activation véhicule de remplacement depuis le dossier | Commission partenariat |
| Médecins (corporel) | Certificats médicaux directement dans le dossier | Extension corporel |

**Commande :**
```bash
/run-pipeline "Marketplace partenaires : rôle PARTNER avec scopes (GARAGE/EXPERT/LAWYER/RENTAL), portail partenaire dédié, invitation email avec token, accès limité au dossier (lecture + upload), dashboard partenaire (mes missions, statuts, paiements)"
```

---

### 🟠 P2-D — Temps Réel (WebSockets + Collaboration)

**Disruption** : Aujourd'hui, si deux gestionnaires ouvrent le même dossier, le dernier à sauvegarder écrase l'autre. Et personne ne voit les changements en direct.

**Ce que ça change :**
- Indicateur "Marie est en train d'éditer ce dossier"
- Commentaires et statuts mis à jour en temps réel (pas besoin de reload)
- Notification toast instantanée quand un dossier assigné est modifié
- Dashboard temps réel : le KPI "Sinistres actifs" s'incrémente sans reload

**Architecture :**
```
Next.js Server → WebSocket (Socket.io ou Pusher)
Events : claim.updated | comment.added | status.changed | user.typing
Rooms  : claim:{id} | team:{managerId} | global:{tenantId}
```

**Commande :**
```bash
/run-pipeline "Temps réel WebSockets : serveur Socket.io intégré Next.js, events claim.updated/comment.added/status.changed, composant RealtimeProvider avec context, hook useLiveUpdates(claimId), indicateur 'X est en train de modifier', toast notifications live, dashboard KPIs auto-refresh"
```

---

## PHASE 3 — Expansion & Disruption Marché (M9–M18)
*Devenir la référence industrie*

---

### 🔴 P3-A — Embedded Insurance (API First pour Distributeurs)

**Disruption** : L'assurance est vendue chez des tiers — concessionnaires, leasing, plateformes auto. Ils veulent intégrer la gestion sinistres directement dans leur app, sans rediriger vers l'assureur.

**Cas d'usage :**
- Un conducteur Uber déclare un sinistre depuis l'app Uber
- Un acheteur Lacentrale.fr déclare depuis le site du vendeur
- Un flottes entreprise crée tous ses sinistres depuis son ERP

**Architecture embedded :**
```
Widget JS (iFrame ou Web Component)
  ← Initialise avec API Key + claimType + context
  ← Formulaire déclaration personnalisé
  → POST /api/v1/claims (API publique)
  → Webhook retour statut

White-label : couleurs, logo, langue, flux configurable
```

**Commande :**
```bash
/run-pipeline "Embedded insurance : widget JS standalone (Web Component), configuration white-label via API Key, formulaire déclaration multi-steps en iframe, flow configurable (champs, types, upload), analytics d'usage par distributeur"
```

---

### 🟠 P3-B — Intelligence Prédictive Préventive

**Disruption** : Passer de réactif (traiter un sinistre) à proactif (prévenir le sinistre ou se préparer avant qu'il arrive).

**Ce que ça change :**
- Prédire quels assurés vont probablement déclarer un sinistre dans les 90 jours
- Alerter les assureurs des zones géographiques à risque accru (météo, période, type de route)
- Conseiller l'assuré proactivement sur la prévention

**Sources de données :**
```
Historique sinistres ClaimFlow
  + Données météo Météo-France (API)
  + Calendrier événements (vacances, salons auto)
  + Statistiques ONISR (accidentologie)
  → Modèle prédictif : score de risque par profil + zone + période
```

**Commande :**
```bash
/run-pipeline "Intelligence prédictive : modèle scoring risque assuré (historique + profil + zone géo + période), API météo intégrée pour corrélation, endpoint /api/analytics/risk-score/:policyholderld, dashboard MANAGER carte chaleur sinistres prédits, alertes préventives email assuré"
```

---

### 🟠 P3-C — Voice-First Déclaration (NLP)

**Disruption** : Déclarer un sinistre par téléphone, à l'oral, et le voir apparaître structuré dans ClaimFlow. Zéro formulaire pour l'assuré.

**Ce que ça change :**
- L'assuré appelle ou laisse un vocal : "J'ai eu un accident ce matin avenue de la gare, ma voiture est une Peugeot 308 immatriculée AA-123-BB, l'autre conducteur est parti"
- L'IA transcrit, extrait les entités, crée le sinistre pré-rempli
- Le gestionnaire valide en 1 clic

**Pipeline :**
```
Audio (Wav/MP3) → Whisper API (transcription)
              → Claude (extraction entités NLP)
              → Sinistre pré-rempli avec confiance
              → Gestionnaire valide/corrige
```

**Entités extraites :** date, heure, lieu, type de sinistre, véhicule impliqués, tiers, dégâts décrits, témoins.

**Commande :**
```bash
/run-pipeline "Voice-first : endpoint /api/ai/transcribe (Whisper API), extraction NLP entités sinistre avec Claude, formulaire pre-rempli avec score de confiance par champ, UI validation gestionnaire avec correction inline, upload audio depuis portail assuré et app mobile"
```

---

### 🟠 P3-D — Audit Réglementaire Automatisé

**Disruption** : La conformité réglementaire (ACPR, IDD, RGPD, Solvabilité II) est un casse-tête manuel. ClaimFlow peut générer automatiquement les rapports réglementaires.

**Ce que ça change :**
- Rapport mensuel ACPR auto-généré (sinistres en retard, taux de règlement, délais moyens)
- Conformité RGPD : purge automatique des données après délai légal, droit à l'oubli
- Rapport Solvabilité II : provisions techniques calculées depuis les sinistres ouverts
- Alerte si un délai légal (Art L. 113-5) va être dépassé

**Commande :**
```bash
/run-pipeline "Audit réglementaire : rapport ACPR PDF auto-généré (template configurable), job cron mensuel, conformité RGPD (droit à l'oubli API, purge automatique, log accès données personnelles), calcul provisions techniques SolvII, export Excel pour commissaire aux comptes"
```

---

### 🟡 P3-E — Blockchain Audit Trail (Immutabilité)

**Disruption** : L'audit trail actuel est en base SQL — modifiable par un admin. En cas de litige judiciaire, l'assureur doit prouver qu'il n'a pas modifié les données. La blockchain rend cela cryptographiquement impossible.

**Ce que ça change :**
- Chaque action critique (création, décision, paiement) est hashée et ancrée sur une chaîne publique
- En cas de litige, l'assureur produit une preuve cryptographique de l'historique
- Standard industrie : interopérable avec d'autres assureurs pour les sinistres multi-assureurs

**Architecture légère (pas de token, pas de crypto) :**
```
Action → Hash SHA256(action + timestamp + userId + claimId)
       → Ancrage sur Polygon (PoS, transactions à 0.001$)
       → Stockage hash + txHash en DB
       → Vérification : recalcul hash + check on-chain
```

**Commande :**
```bash
/run-pipeline "Blockchain audit trail : hash SHA256 sur actions critiques, ancrage Polygon via ethers.js, table BlockchainAnchor (hash, txHash, blockNumber, timestamp), API /api/claims/:id/verify-integrity retourne preuve cryptographique, UI badge 'Vérifié blockchain' sur timeline"
```

---

### 🟡 P3-F — Intelligence Collective Inter-Assureurs

**Disruption** : Chaque assureur voit ses propres fraudes. Mais un fraudeur change d'assureur — et recommence. Une intelligence partagée (anonymisée) multiplie la détection par 10.

**Ce que ça change :**
- Un fingerprint anonymisé des dossiers frauduleux est partagé entre tenants ClaimFlow
- Si un assuré suspecté chez AXA déclare chez MAIF → alerte immédiate
- Les patterns de fraude détectés par un assureur bénéficient à tous

**Architecture privacy-preserving :**
```
Données locales (tenant A)
  → Extraction fingerprint anonymisé (hash VIN + hash lieu + type sinistre)
  → Réseau fédéré ClaimFlow Intelligence
  ← Score de risque agrégé (aucune donnée personnelle échangée)
```

**Commande :**
```bash
/run-pipeline "Intelligence collective : fingerprinting anonymisé (hash irréversible des entités fraude), réseau fédéré inter-tenants via API interne, table FraudIntelligence (fingerprint, riskScore, reportCount, lastSeen), enrichissement automatique analyzeFraud() avec score réseau, dashboard ADMIN contribution réseau"
```

---

## PHASE 4 — Nouvelles Verticales (M12–M24)

---

### 🟡 P4-A — Extension Sinistres Corporels

La gestion des sinistres corporels (accidents avec blessés) est le marché le plus complexe et le plus lucratif. Barèmes ONIAM, calculs IPP, pensions viagères — tout est manuel aujourd'hui.

**Nouvelles entités :**
- `BodilyInjury` : ITT, IPP, préjudice esthétique, pretium doloris
- Barèmes ONIAM + Dintilhac intégrés dans le MCP barèmes
- Workflow médico-légal : médecin conseil, expertise médicale contradictoire

**Commande :**
```bash
/run-pipeline "Sinistres corporels : nouveaux types BODILY_INJURY/PEDESTRIAN, table BodilyInjury (ITT, IPP, prejudices), barèmes ONIAM dans MCP, calcul automatique indemnisation Claude avec références légales, workflow médecin conseil, rapport medico-légal PDF"
```

---

### 🟡 P4-B — Assurance Flotte Entreprise

Les flottes de véhicules (transporteurs, VTC, rental) gèrent des centaines de sinistres par mois avec des contraintes spécifiques : bonus-malus flotte, conducteurs multiples, gestion centralisée.

**Nouvelles fonctionnalités :**
- Import CSV flotte (véhicules + conducteurs)
- Dashboard flotte : sinistralité par conducteur, véhicule, type de trajet
- Bonus-malus flotte calculé automatiquement
- Connexion ERP (API) pour création automatique de sinistres

**Commande :**
```bash
/run-pipeline "Flotte entreprise : entité Fleet + FleetVehicle + FleetDriver, import CSV, dashboard sinistralité flotte (par conducteur/véhicule/période), calcul CRM flotte, API ERP /api/v1/fleets/:id/claims"
```

---

## Récapitulatif — Matrice Impact / Effort

| # | Fonctionnalité | Phase | Effort | Impact Business | Disruption |
|---|---------------|-------|--------|----------------|------------|
| 1 | Agents IA Autonomes (Autopilot) | 1 | XL | 💰💰💰💰💰 | 🚀🚀🚀🚀🚀 |
| 2 | Computer Vision dégâts | 1 | M | 💰💰💰💰 | 🚀🚀🚀🚀 |
| 3 | Fraude en réseau | 1 | L | 💰💰💰💰💰 | 🚀🚀🚀🚀 |
| 4 | Multi-tenant SaaS | 2 | XL | 💰💰💰💰💰 | 🚀🚀🚀🚀🚀 |
| 5 | API publique + Webhooks | 2 | L | 💰💰💰💰 | 🚀🚀🚀🚀 |
| 6 | Marketplace Partenaires | 2 | L | 💰💰💰 | 🚀🚀🚀 |
| 7 | WebSockets temps réel | 2 | M | 💰💰 | 🚀🚀 |
| 8 | Estimation prédictive ML | 1 | M | 💰💰💰 | 🚀🚀🚀 |
| 9 | Embedded Insurance | 3 | L | 💰💰💰💰💰 | 🚀🚀🚀🚀🚀 |
| 10 | Voice-First déclaration | 3 | M | 💰💰💰 | 🚀🚀🚀🚀 |
| 11 | Audit réglementaire auto | 3 | M | 💰💰💰 | 🚀🚀🚀 |
| 12 | Blockchain audit trail | 3 | M | 💰💰 | 🚀🚀 |
| 13 | Intelligence inter-assureurs | 3 | XL | 💰💰💰💰💰 | 🚀🚀🚀🚀🚀 |
| 14 | Sinistres corporels | 4 | XL | 💰💰💰💰 | 🚀🚀🚀 |
| 15 | Flotte entreprise | 4 | L | 💰💰💰 | 🚀🚀 |
| 16 | Intelligence prédictive | 3 | L | 💰💰💰 | 🚀🚀🚀 |

---

## Roadmap Temporelle

```
M1–M3  : PHASE 1 — Intelligence
          ├── Agents IA Autonomes (autopilot)
          ├── Computer Vision
          └── Fraude en réseau

M4–M8  : PHASE 2 — Plateforme
          ├── Multi-tenant SaaS ← point de bascule
          ├── API publique + SDK npm
          ├── WebSockets temps réel
          └── Marketplace partenaires

M9–M12 : PHASE 3 — Disruption
          ├── Embedded Insurance
          ├── Voice-First
          ├── Audit réglementaire
          ├── Intelligence inter-assureurs
          └── Blockchain audit trail

M12–M24: PHASE 4 — Nouvelles verticales
          ├── Sinistres corporels
          └── Flotte entreprise
```

---

## Métriques de succès (dans 18 mois)

| Métrique | Aujourd'hui | Cible M18 |
|---------|------------|-----------|
| Sinistres auto-traités | 0% | 60% |
| Délai moyen traitement | 12 jours | 2 jours |
| Coût par sinistre | 320€ | 90€ |
| Fraudes détectées | ~15% | ~40% |
| Tenants (assureurs) | 1 | 10 |
| Sinistres traités/an | 10k | 500k |

---

## Commandes disponibles

| Commande | Usage |
|----------|-------|
| `/run-pipeline "<user story>"` | Pipeline complet BA → Archi → Design → Backend → Frontend → IA → QA → Review |
| `/feature-dev "<user story>"` | Feature full-stack directe |
| `/ia "<contexte>"` | Prompts + fonctions Claude |
| `/backend "<plan>"` | Routes API + Prisma |
| `/frontend "<plan>"` | Pages + composants |
| `/qa` | Vitest + Playwright E2E |
| `/migrate` | Migration Prisma |
| `/seed` | Reset + reseed BDD |
| `/test` | Tests + coverage |
| `/debug "<erreur>"` | Analyser un bug |
| `/commit` | Commit conventionnel |
| `/status` | État du projet |

---

## Prochain sprint recommandé

**Sprint "Autopilot" (impact maximal, 3 semaines) :**

```bash
# 1. Computer Vision — le plus rapide, impact immédiat visible
/run-pipeline "Analyse photos Claude Vision : endpoint /api/ai/analyze-images, prompt structuré dégâts auto, résultat JSON zone/gravité/cohérence/flags suspects, intégration AIAnalysisPanel"

# 2. Fraude en réseau — enrichit l'IA existante sans refonte
/run-pipeline "Fraude réseau : graphe assurés/garages/lieux, détection clusters, table FraudNetwork, enrichissement analyzeFraud() avec score réseau"

# 3. Premier agent autonome — le plus disruptif
/run-pipeline "Agent triage autonome : Claude agent qui analyse, class et instruit les dossiers < 500€ sans intervention humaine, log AgentRun, dashboard supervision"
```
