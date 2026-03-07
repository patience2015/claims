# ClaimFlow — Roadmap Produit

> **Analyse critique** : L'application couvre bien le workflow gestionnaire → sinistre → IA → décision.
> Mais elle a des angles morts majeurs : l'assuré est absent (on parle de lui, il n'agit pas), les managers manquent de pilotage d'équipe, et l'IA ne fait pas encore de corrélation inter-dossiers.

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

---

## Cas d'utilisation manquants — Analyse critique

### 🔴 Angle mort #1 : L'assuré n'existe pas en tant qu'acteur
L'assuré est une fiche (`Policyholder`) mais ne peut pas se connecter, suivre son dossier, ni communiquer directement. Tout passe par le gestionnaire — c'est un goulot d'étranglement et une mauvaise expérience client.

### 🔴 Angle mort #2 : Le manager ne pilote pas son équipe
Le dashboard montre des KPIs globaux mais pas la charge de travail par gestionnaire, les sinistres en retard, ni les performances individuelles.

### 🟠 Angle mort #3 : L'IA ne corrèle pas les dossiers entre eux
La fraude est analysée dossier par dossier. Un assuré qui déclare 3 vols en 2 ans, ou deux sinistres au même endroit la même semaine, n'est pas détecté.

### 🟠 Angle mort #4 : Pas de gestion des délais réglementaires
En assurance, les délais de réponse sont réglementés. Aucune alerte si un dossier reste 30 jours sans décision.

### 🟡 Angle mort #5 : Pas d'expertise terrain
Le workflow s'arrête à la décision. Pas de mission d'expertise, pas de rapport expert, pas de rendez-vous assuré.

---

## Roadmap — Nouvelles fonctionnalités

---

### P1 — Portail Assuré Self-Service
**Valeur** : L'assuré suit son dossier en temps réel, soumet des documents sans appeler le gestionnaire, réduit la charge support de 40%.

**User Stories :**
- En tant qu'assuré, je peux me connecter avec mon numéro de police + email
- Je vois le statut de mes sinistres en cours et l'historique
- Je peux uploader des documents supplémentaires demandés
- Je reçois un email automatique à chaque changement de statut
- Je peux accepter ou refuser une proposition d'indemnisation

**Modèle de données :**
- Ajout du rôle `POLICYHOLDER` dans `User`
- Liaison `User ↔ Policyholder`
- Nouveau statut sinistre : `AWAITING_ACCEPTANCE`

**Commande à lancer :**
```bash
/run-pipeline "Portail assuré self-service : nouveau rôle POLICYHOLDER, authentification par numéro de police + email, vue lecture seule de ses sinistres, upload documents, acceptation/refus proposition d'indemnisation, emails automatiques sur changement de statut"
```

---

### P1 — Notifications & Alertes (email + in-app)
**Valeur** : Aucune notification n'existe. Les gestionnaires manquent des escalades urgentes, les assurés ne savent pas où en est leur dossier.

**User Stories :**
- Gestionnaire notifié par email quand un sinistre lui est assigné
- Manager alerté quand un sinistre dépasse 30 jours sans décision (SLA)
- Manager alerté quand un score de fraude > 70 est détecté
- Assuré notifié quand son statut change ou quand des documents sont demandés
- Notification in-app (bandeau) pour les alertes urgentes

**Modèle de données :**
- Table `Notification` (userId, type, title, body, read, claimId, createdAt)
- Table `NotificationPreference` (userId, email, inApp, types[])
- Champ `slaDeadline` sur `Claim` (calculé à la création)

**Commande à lancer :**
```bash
/run-pipeline "Système de notifications : table Notification + NotificationPreference, API GET/PATCH /api/notifications, service d'envoi email (nodemailer), alertes SLA 30j sur cron job, badge in-app non-lus dans Navbar, email automatique assignation/changement statut/fraude élevée"
```

---

### P1 — Tableau de bord Équipe (Manager)
**Valeur** : Le manager voit des KPIs globaux mais ne sait pas qui est surchargé, qui est en retard, ni quelle est la performance de chaque gestionnaire.

**User Stories :**
- Voir la charge de travail de chaque gestionnaire (sinistres actifs, en retard, résolus ce mois)
- Identifier les sinistres en retard (> SLA) d'un coup d'œil
- Voir le taux d'approbation / rejet par gestionnaire
- Réassigner rapidement les sinistres d'un gestionnaire absent

**Nouvelles routes API :**
- `GET /api/dashboard/team` — stats par gestionnaire
- `GET /api/dashboard/sla` — sinistres en dépassement SLA
- `POST /api/claims/bulk-assign` — réassignation en masse

**Commande à lancer :**
```bash
/run-pipeline "Dashboard équipe Manager : routes /api/dashboard/team et /api/dashboard/sla, tableau gestionnaires avec charge/retards/performance, badge rouge si SLA dépassé, réassignation bulk depuis le dashboard"
```

---

### P2 — Détection de Fraude Inter-Dossiers (IA corrélation)
**Valeur** : La fraude la plus rentable est le récidivisme. Un assuré avec 3 sinistres en 18 mois ou deux sinistres au même endroit à une semaine d'intervalle est suspect — mais actuellement invisible.

**User Stories :**
- À l'analyse IA, croiser le sinistre avec l'historique de l'assuré
- Alerter si l'assuré a eu > 2 sinistres similaires en 24 mois
- Signaler si le lieu d'un sinistre correspond à un lieu déjà déclaré récemment
- Tableau "Assurés à risque" pour le manager

**Évolutions IA :**
- Enrichir le prompt `analyzeFraud` avec l'historique sinistres de l'assuré
- Nouveau facteur : `historique_sinistres` avec poids +20 si > 2 en 24 mois
- Nouveau facteur : `lieu_recurrent` avec poids +25 si même lieu dans l'année

**Commande à lancer :**
```bash
/run-pipeline "Fraude inter-dossiers : enrichir analyzeFraud() avec historique sinistres assuré, nouveaux facteurs récidivisme et lieu récurrent, page 'Assurés à risque' MANAGER avec liste triée par score fraude moyen"
```

---

### P2 — Gestion des Délais SLA
**Valeur** : En assurance, le Code des assurances impose des délais légaux. Aucun mécanisme de suivi n'existe aujourd'hui — exposition légale.

**Délais réglementaires (France) :**
- Accusé réception : 10 jours ouvrés
- Décision finale : 30 jours ouvrés après réception des pièces
- Paiement : 15 jours après accord

**User Stories :**
- Chaque sinistre a une date limite calculée automatiquement à la création
- Bandeau rouge sur un sinistre proche ou en dépassement SLA
- Export des sinistres en dépassement pour le reporting réglementaire
- Alerte manager J-5 avant dépassement

**Modèle de données :**
- Champs sur `Claim` : `slaAcknowledgmentDeadline`, `slaDecisionDeadline`, `slaPaymentDeadline`
- Table `SLAAlert` (claimId, type, dueDate, alertedAt, resolved)

**Commande à lancer :**
```bash
/run-pipeline "SLA sinistres : calcul automatique deadlines à la création (10j accusé, 30j décision, 15j paiement), badge SLA sur liste et détail sinistre, API /api/claims/sla-overdue, export CSV sinistres en dépassement, alerte email manager J-5"
```

---

### P2 — Missions d'Expertise
**Valeur** : Certains sinistres nécessitent une expertise terrain (expert automobile indépendant). Ce workflow n'est pas modélisé.

**User Stories :**
- Le manager peut créer une mission d'expertise pour un sinistre
- L'expert reçoit un email avec les détails du dossier et les documents
- L'expert peut uploader son rapport dans le système
- Le rapport est automatiquement soumis à l'IA pour mise à jour de l'estimation
- Nouveau statut sinistre : `EXPERT_PENDING`, `EXPERT_DONE`

**Modèle de données :**
- Table `ExpertMission` (claimId, expertName, expertEmail, appointmentDate, reportUrl, status)
- Nouveaux statuts : `EXPERT_PENDING`, `EXPERT_DONE`

**Commande à lancer :**
```bash
/run-pipeline "Missions d'expertise : table ExpertMission, nouveaux statuts EXPERT_PENDING/EXPERT_DONE, API CRUD /api/claims/[id]/expertise, email automatique à l'expert avec lien upload, relance IA estimation après réception rapport"
```

---

### P2 — Export PDF Dossier Complet
**Valeur** : L'export CSV existe mais est limité. Un dossier complet (sinistre + assuré + documents + analyse IA + historique) doit pouvoir être exporté en PDF pour archivage ou envoi à un avocat.

**User Stories :**
- Télécharger un PDF récapitulatif d'un dossier depuis la page de détail
- Le PDF inclut : informations assuré, détails sinistre, score fraude, estimation, timeline des actions
- Format professionnel avec logo et en-tête assureur

**Commande à lancer :**
```bash
/run-pipeline "Export PDF dossier : librairie puppeteer ou @react-pdf/renderer, route GET /api/claims/[id]/export?format=pdf, template PDF professionnel avec toutes les sections du dossier, bouton télécharger sur page détail"
```

---

### P3 — Analyse IA des Photos de Dégâts
**Valeur** : Les photos des dégâts sont uploadées mais jamais analysées. Claude Vision peut estimer les dommages directement depuis les photos.

**User Stories :**
- Lors de l'analyse IA, les images uploadées sont envoyées à Claude Vision
- L'IA décrit les dégâts visibles, estime leur gravité (MINOR/MODERATE/SEVERE)
- L'estimation intègre les résultats visuels pour plus de précision
- Détection de dégâts pré-existants vs récents

**Évolutions techniques :**
- Endpoint `POST /api/ai/analyze-images` avec base64 des images
- Enrichissement du prompt estimation avec la description visuelle
- Nouveau champ `AIAnalysis.imageAnalysis` (JSON)

**Commande à lancer :**
```bash
/run-pipeline "Analyse photos Claude Vision : endpoint /api/ai/analyze-images, envoi base64 des images JPG/PNG à claude-sonnet-4-6 avec prompt dégâts, résultats intégrés dans estimation, affichage description visuelle dans AIAnalysisPanel"
```

---

### P3 — Chatbot Assistant Dossier
**Valeur** : Le gestionnaire doit lire l'intégralité du dossier pour répondre à une question. Un assistant Claude contextuel peut répondre instantanément ("Quels documents manquent ?", "Pourquoi ce score de fraude ?", "Que dit la police d'assurance ?").

**User Stories :**
- Bouton "Poser une question" sur la page détail d'un sinistre
- Chat contextuel : Claude a accès à toutes les données du dossier
- Questions typiques : statut, documents manquants, explication fraude, historique assuré, prochaine étape recommandée
- Historique des questions posées sur le dossier

**Commande à lancer :**
```bash
/run-pipeline "Chatbot assistant dossier : composant ChatPanel sur page détail sinistre, POST /api/ai/chat avec contexte complet dossier (claim + policyholder + documents + analyses), streaming réponse Claude, historique session"
```

---

### P3 — Règles Métier Configurables
**Valeur** : Les seuils (2000€ auto-approbation, score 70 escalade) sont codés en dur. En production, ils doivent être configurables sans déploiement.

**User Stories :**
- Interface admin pour modifier les seuils métier
- Seuil auto-approbation : montant max configurable par type de sinistre
- Seuil escalade fraude : niveau de risque configurable
- Historique des modifications de règles (qui a changé quoi et quand)

**Modèle de données :**
- Table `BusinessRule` (key, value, description, updatedAt, updatedBy)
- Clés : `AUTO_APPROVAL_MAX_AMOUNT`, `FRAUD_ESCALATION_THRESHOLD`, `SLA_DECISION_DAYS`, etc.

**Commande à lancer :**
```bash
/run-pipeline "Règles métier configurables : table BusinessRule, API CRUD /api/admin/rules, page admin onglet Règles avec formulaire édition, service getRuleValue(key) dans claim-service.ts, remplacement des constantes hardcodées"
```

---

### P3 — Application Mobile (PWA)
**Valeur** : Les gestionnaires font des constats sur le terrain. Une app mobile permet de créer un sinistre, photographier les dégâts et uploader depuis le lieu du sinistre.

**User Stories :**
- Application Progressive Web App (sans app store)
- Capture photo directe depuis la caméra du téléphone
- Formulaire de création sinistre optimisé mobile
- Mode hors-ligne avec synchronisation

**Commande à lancer :**
```bash
/run-pipeline "PWA mobile : manifest.json, service worker offline, composants responsive mobile-first, capture caméra native sur formulaire upload documents, page offline.tsx"
```

---

## Récapitulatif Priorisation

| # | Fonctionnalité | Priorité | Effort | Impact |
|---|---------------|----------|--------|--------|
| 1 | Portail Assuré Self-Service | 🔴 P1 | Large | ⭐⭐⭐⭐⭐ |
| 2 | Notifications & Alertes | 🔴 P1 | Medium | ⭐⭐⭐⭐⭐ |
| 3 | Dashboard Équipe Manager | 🔴 P1 | Medium | ⭐⭐⭐⭐ |
| 4 | Fraude Inter-Dossiers | 🟠 P2 | Medium | ⭐⭐⭐⭐⭐ |
| 5 | Gestion SLA | 🟠 P2 | Medium | ⭐⭐⭐⭐ |
| 6 | Missions d'Expertise | 🟠 P2 | Large | ⭐⭐⭐ |
| 7 | Export PDF Dossier | 🟠 P2 | Small | ⭐⭐⭐ |
| 8 | Analyse Photos IA | 🟡 P3 | Small | ⭐⭐⭐⭐ |
| 9 | Chatbot Assistant | 🟡 P3 | Medium | ⭐⭐⭐⭐ |
| 10 | Règles Métier Config | 🟡 P3 | Small | ⭐⭐⭐ |
| 11 | Application Mobile PWA | 🟡 P3 | Large | ⭐⭐ |

---

## Commandes disponibles (rappel)

| Commande | Usage |
|----------|-------|
| `/run-pipeline "<user story>"` | Pipeline complet BA → Archi → Backend → Frontend → IA → QA → Review |
| `/ba "<user story>"` | Seulement les specs Gherkin + règles métier |
| `/architect "<specs>"` | Seulement le plan technique (API + Prisma) |
| `/feature-dev "<user story>"` | Feature full-stack directe sans pipeline complet |
| `/migrate` | Nouvelle migration Prisma après changement schéma |
| `/test` | Lancer Vitest + coverage |
| `/e2e` | Lancer tests Playwright |
| `/debug "<erreur>"` | Analyser et corriger un bug |
| `/perf` | Audit performance (N+1, bundle, routes lentes) |
| `/commit` | Commit conventionnel + push |
| `/status` | État du projet (serveur, BDD, tests, git) |

---

## Recommandation de démarrage

**Sprint 1 (priorité maximale ROI) :**
1. Notifications → `/run-pipeline "Notifications email sur changement statut sinistre"` ← le plus rapide, impact immédiat
2. Dashboard Équipe → `/run-pipeline "Dashboard équipe avec charge par gestionnaire et alertes SLA"`
3. SLA → peut être embarqué dans le sprint 1 (modèle de données simple)

**Sprint 2 :**
4. Portail assuré (plus complexe — nouveau rôle, auth séparée)
5. Fraude inter-dossiers (enrichissement prompt, pas de nouveau modèle)
