# Product Requirements Document — ClaimFlow AI

**Version** : 1.0 — Mars 2026  
**Statut** : Validé — Prêt pour développement  
**Projet** : Formation Claude Code — Leadmind AI  
**Horizon** : 5 jours · Sprint unique · Binôme  
**Domaine** : Assurance automobile · InsurTech  
**Stack cible** : Next.js 15 · Prisma · Claude API  
**Session** : projet-claims

---

## Table des matières

1. [Vision Produit](#1-vision-produit)
2. [Utilisateurs Cibles](#2-utilisateurs-cibles)
3. [Périmètre Fonctionnel](#3-périmètre-fonctionnel)
4. [Règles Métier](#4-règles-métier)
5. [Architecture Technique](#5-architecture-technique)
6. [Intégration IA — Design des Appels Claude](#6-intégration-ia--design-des-appels-claude)
7. [Plan de Livraison — Sprint 5 Jours](#7-plan-de-livraison--sprint-5-jours)
8. [Qualité & Critères d'Évaluation](#8-qualité--critères-dévaluation)
9. [Risques & Points d'Attention](#9-risques--points-dattention)

---

## 1. Vision Produit

### 1.1 Problème adressé

La gestion des sinistres automobiles est le premier poste de coûts des assureurs. Pourtant, le processus reste massivement manuel : un gestionnaire passe 15 à 20 minutes sur la saisie d'un seul dossier, la détection de fraude repose sur l'intuition humaine, et chaque courrier à l'assuré est rédigé from scratch. Ce n'est pas un problème d'outils — c'est un problème d'automatisation intelligente.

| Problème actuel | Impact mesuré | Ce que l'IA change |
|---|---|---|
| Saisie manuelle des déclarations | 15–20 min par dossier, erreurs fréquentes | Extraction automatique des données clés depuis le texte libre |
| Détection de fraude 100% humaine | 5–10 % des fraudes non détectées en Europe | Scoring 0–100 avec 8 indicateurs pondérés, déclenchement auto |
| Courriers rédigés manuellement | 10–15 min par courrier, ton inconsistant | Génération instantanée de 5 types de courriers personnalisés |
| Pilotage par tableur | Perte de visibilité, délais non maîtrisés | Dashboard analytics temps réel avec KPIs et graphiques |
| Estimation subjective du montant | Disparités entre gestionnaires, litiges | Suggestion IA basée sur barèmes métier standardisés |

### 1.2 Proposition de valeur

> ClaimFlow AI réduit le temps de traitement d'un sinistre de 45 minutes à moins de 10 minutes, en automatisant extraction, scoring, estimation et génération documentaire — sans supprimer le jugement humain, mais en l'augmentant.

Le POC vise trois objectifs simultanés : démontrer la viabilité technique d'une plateforme IA dans le secteur assurance, constituer un asset commercial démontrable pour Leadmind AI, et servir de terrain d'entraînement complet à la formation Claude Code.

### 1.3 Positionnement marché

Le marché de l'IA générative en assurance a atteint 320 M$ en 2024, soit +357 % en un an. Pourtant, seulement 7 % des assureurs ont réussi à passer à l'échelle. Cet écart représente une fenêtre d'opportunité directe pour un POC démontrable.

| Acteur | Projet | Résultat documenté |
|---|---|---|
| Allianz | Projet Nemo | −80 % du temps de traitement des sinistres |
| Sedgwick | Sidekick Agent | +30 % d'efficacité des gestionnaires |
| Aviva | Automatisation sinistres auto | 82 M$ d'économies annuelles en 2024 |

---

## 2. Utilisateurs Cibles

ClaimFlow AI est conçu pour trois rôles distincts, avec des besoins et des permissions différenciés. La plateforme doit s'adapter à chacun sans les contraindre à un flux uniforme.

| Rôle | Profil | Frustration centrale | Gain attendu |
|---|---|---|---|
| Gestionnaire (handler) | Julie, 32 ans — 5 ans d'exp. · 15-20 dossiers/jour | Saisie répétitive, pression sur les délais, fraude difficile à détecter | Traiter 5× plus vite · être alertée automatiquement sur les cas suspects |
| Manager sinistres | Marc, 45 ans — supervise 8 gestionnaires | Manque de visibilité temps réel · reporting manuel chronophage | Piloter avec des KPIs live · escalade automatique des dossiers critiques |
| Administrateur | Thomas, 28 ans — profil technique | Création de comptes manuelle · règles métier codées en dur | Administrer users et seuils via UI · exporter les données librement |

### 2.1 Parcours utilisateur principal (Julie — Gestionnaire)

Le parcours type couvre l'intégralité du cycle de vie d'un sinistre en une seule session :

1. Connexion → redirection automatique vers la liste de ses sinistres assignés
2. Saisie d'une nouvelle déclaration via le formulaire 4 étapes (< 3 min)
3. Lancement de l'analyse IA en 1 clic → résultats en < 10 secondes
4. Lecture du score de fraude : si > 70, escalade automatique au manager
5. Génération du courrier d'accusé de réception en 1 clic
6. Suivi du workflow jusqu'à clôture du dossier

---

## 3. Périmètre Fonctionnel

### 3.1 Vue d'ensemble des épics

| Épic | Intitulé | Priorité | # US | Valeur principale |
|---|---|---|---|---|
| E1 | Authentification & Rôles | HAUTE | 5 | Accès sécurisé différencié par rôle |
| E2 | Déclaration de sinistre | HAUTE | 6 | Saisie guidée, structurée, sans perte |
| E3 | Analyse IA | HAUTE | 6 | Extraction + fraude + estimation + courrier |
| E4 | Workflow & Traçabilité | HAUTE | 6 | Statuts, attribution, audit trail complet |
| E5 | Dashboard Analytics | MOYENNE | 5 | Pilotage managérial en temps réel |
| E6 | Administration | BASSE | 5 | Configuration autonome sans code |

---

### 3.2 Épic 1 — Authentification & Rôles

L'authentification conditionne l'expérience de chaque rôle. La redirection post-login doit être transparente et automatique.

| ID | User Story | Critère d'acceptation clé |
|---|---|---|
| US-1.1 | Me connecter avec email / mot de passe | Redirection automatique selon rôle · session JWT 8h |
| US-1.2 | Voir mon profil et mon rôle affiché | Nom + rôle visibles dans le header à tout moment |
| US-1.3 | Être redirigé selon mon rôle | handler → /claims · manager → /dashboard · admin → /admin |
| US-1.4 | Me déconnecter proprement | Invalidation session · retour page login |
| US-1.5 | Comptes désactivables (admin) | Un compte inactif ne peut pas se connecter |

---

### 3.3 Épic 2 — Déclaration de sinistre

Le formulaire est le point d'entrée de toute la valeur IA. Il doit guider le gestionnaire sans le contraindre, et capturer assez de contexte pour que Claude puisse extraire des données de qualité.

| ID | User Story | Critère d'acceptation clé |
|---|---|---|
| US-2.1 | Remplir un formulaire multi-étapes structuré | 4 étapes : assuré, véhicule, circonstances, documents · validation par étape |
| US-2.2 | Uploader des photos et documents | Multi-fichiers · preview · max 10 Mo/fichier · PDF, JPG, PNG |
| US-2.3 | Recevoir un numéro auto-généré | Format SIN-YYYY-NNNNN · immutable · généré à la soumission |
| US-2.4 | Sauvegarder en brouillon | Reprise possible à tout moment · statut 'draft' visible |
| US-2.5 | Saisir les informations du tiers | Champs conditionnels si tiers impliqué (case à cocher) |
| US-2.6 | Soumettre et déclencher le traitement | Statut → SUBMITTED · accusé de réception possible en 1 clic |

---

### 3.4 Épic 3 — Analyse IA

C'est le cœur différenciant du produit. Quatre appels Claude API distincts, orchestrés en séquence, chacun avec un rôle précis et une sortie JSON structurée.

| Fonction IA | Entrée | Sortie attendue | Seuil de performance |
|---|---|---|---|
| Extraction | Description libre du sinistre (texte) | JSON : date, lieu, véhicules, dommages, blessures, tiers, lacunes | < 10 s · champs manquants signalés |
| Scoring fraude | Données du dossier complet | Score 0–100 · liste d'indicateurs pondérés · recommandation | < 10 s · 8 indicateurs évalués |
| Estimation montant | Type sinistre + données extraites | Min / max / probable · ventilation par poste · franchise | < 10 s · basée sur barème métier |
| Génération courrier | Dossier + type de courrier sélectionné | Objet + corps + formule · prêt à envoyer | < 5 s · 5 types disponibles |

#### Indicateurs de fraude évalués automatiquement

| Indicateur | Logique de détection | Poids |
|---|---|---|
| Déclaration tardive | Sinistre déclaré > 30 jours après les faits | +15 pts |
| Historique sinistres | 3+ sinistres sur les 12 derniers mois (même assuré) | +20 pts |
| Montant disproportionné | Montant déclaré > 2× valeur Argus du véhicule | +25 pts |
| Description vague | Description libre < 50 caractères | +10 pts |
| Véhicule récemment assuré | Police souscrite < 3 mois avant le sinistre | +15 pts |
| Absence de témoins | Collision déclarée sans témoin ni forces de l'ordre | +10 pts |
| Zone géographique suspecte | Sinistre dans une zone à forte densité de fraudes | +10 pts |
| Horaire atypique | Sinistre entre 1h et 5h du matin | +5 pts |

#### Seuils et actions

| Score | Niveau | Affichage | Action déclenchée |
|---|---|---|---|
| 0 – 30 | Faible | 🟢 Vert | Traitement normal · auto-approbation possible |
| 31 – 60 | Modéré | 🟠 Orange | Vérification recommandée · pas d'escalade auto |
| 61 – 80 | Élevé | 🔴 Rouge | Escalade automatique au manager · investigation requise |
| 81 – 100 | Critique | 🔴 Rouge foncé | Blocage + escalade urgente + signalement possible |

| ID | User Story | Critère d'acceptation clé |
|---|---|---|
| US-3.1 | Lancer l'analyse IA en 1 clic | Résultats complets en < 10 s · bouton désactivé pendant l'analyse |
| US-3.2 | Voir les données extraites automatiquement | Panel dédié · champs éditables · lacunes signalées |
| US-3.3 | Voir le score de fraude avec indicateurs visuels | Jauge 0–100 · code couleur · liste des indicateurs détectés |
| US-3.4 | Voir l'estimation du montant d'indemnisation | Min/max/probable · ventilation par poste · franchise déduite |
| US-3.5 | Générer un courrier automatique | Select type · aperçu avant envoi · 5 types disponibles |
| US-3.6 | Historique des analyses IA | Toutes les analyses tracées avec date, modèle et tokens consommés |

---

### 3.5 Épic 4 — Workflow & Traçabilité

Le workflow garantit que chaque sinistre progresse de façon contrôlée et traçable. Toutes les transitions sont auditées automatiquement.

```
SUBMITTED → UNDER_REVIEW → INFO_REQUESTED → APPROVED / REJECTED → CLOSED
```

| ID | User Story | Critère d'acceptation clé |
|---|---|---|
| US-4.1 | Voir la liste filtrée de mes sinistres | Filtres : statut, type, date, gestionnaire, recherche texte libre |
| US-4.2 | Changer le statut d'un sinistre | Transitions autorisées uniquement · transitions invalides bloquées |
| US-4.3 | Attribuer à un gestionnaire | Statut passe auto à UNDER_REVIEW · gestionnaire notifié |
| US-4.4 | Ajouter des commentaires internes | Horodatés · auteur tracé · invisibles de l'assuré |
| US-4.5 | Consulter l'historique complet | Chaque action logguée : auteur, date, avant/après · non modifiable |
| US-4.6 | Escalade automatique si fraude > 70 | Assignation auto au manager · notification · statut mis à jour |

---

### 3.6 Épics 5 & 6 — Dashboard & Administration

| Fonctionnalité | Épic | Description |
|---|---|---|
| KPIs temps réel | E5 | Nb sinistres par statut · montant total · délai moyen · taux fraude |
| Graphiques | E5 | Line chart évolution mensuelle + Pie chart répartition par type (Recharts) |
| Filtres dashboard | E5 | Période : 7j, 30j, 90j, personnalisé · par type · par gestionnaire |
| Gestion utilisateurs | E6 | CRUD : créer, modifier, désactiver · rôle assignable |
| Seuils configurables | E6 | Seuil auto-approbation (€) · seuil escalade fraude (score) — sans redéploiement |
| Export CSV | E6 | Export filtrable · toutes colonnes · encodage UTF-8 · déclenché à la demande |

---

## 4. Règles Métier

### 4.1 Automatisations déclenchées par le système

Ces règles s'appliquent sans intervention humaine. Elles sont configurables par un administrateur via l'interface.

| Règle | Condition | Action automatique | Configurable ? |
|---|---|---|---|
| Auto-approbation | Montant estimé < 2 000 € ET score fraude < 30 | Statut → APPROVED sans validation gestionnaire | Oui (seuil montant) |
| Escalade manager | Score fraude > 70 | Assignation automatique au manager · statut → UNDER_REVIEW | Oui (seuil score) |
| Alerte délai | Aucune action 48h après création | Notification interne à l'équipe assignée | Non (fixe) |
| Numérotation | Toute nouvelle déclaration soumise | Génération SIN-YYYY-NNNNN · auto-incrémenté par année | Non (format fixe) |

### 4.2 Transitions de statut autorisées

| De | Vers | Condition | Acteur |
|---|---|---|---|
| SUBMITTED | UNDER_REVIEW | Attribution à un gestionnaire | Manager ou système |
| UNDER_REVIEW | INFO_REQUESTED | Pièces manquantes détectées | Gestionnaire |
| UNDER_REVIEW | APPROVED | Dossier complet + montant validé (ou auto-approbation) | Gestionnaire / système |
| UNDER_REVIEW | REJECTED | Motif de refus documenté | Gestionnaire |
| INFO_REQUESTED | UNDER_REVIEW | Pièces complémentaires reçues | Gestionnaire |
| APPROVED | CLOSED | Indemnisation versée | Système |
| REJECTED | CLOSED | Délai de contestation expiré (30 jours) | Système |

### 4.3 Barèmes d'indemnisation de référence

| Type de sinistre | Catégorie dommage | Fourchette indicative |
|---|---|---|
| Bris de glace | Pare-brise | 300 – 800 € |
| Bris de glace | Vitre latérale / lunette | 150 – 600 € |
| Collision | Carrosserie légère (rayure, bosse) | 300 – 1 500 € |
| Collision | Carrosserie lourde (déformation structurelle) | 1 500 – 8 000 € |
| Collision / Tous risques | Perte totale | Valeur Argus − franchise |
| Vol total | Véhicule disparu | Valeur Argus − franchise − vétusté |
| Vandalisme | Dégradation légère à lourde | 200 – 5 000 € |
| Incendie | Partiel à total | 2 000 € → Valeur Argus |
| Catastrophe naturelle | Variable selon dommages | Franchise légale 380 € minimum |
| Dommages corporels légers | Tous types | 1 000 – 5 000 € |

### 4.4 Délais réglementaires

| Étape | Délai maximum | Base légale |
|---|---|---|
| Accusé de réception | 48 h après la déclaration | Code des assurances L113-5 |
| Proposition d'indemnisation | 3 mois après la déclaration | Convention IRSA |
| Versement après accord | 1 mois après l'accord | Code des assurances L122-2 |
| Délai de contestation d'un refus | 2 ans à compter de l'événement | Code des assurances L114-1 |

---

## 5. Architecture Technique

### 5.1 Choix d'architecture : monorepo Next.js

Le projet adopte une architecture monorepo fullstack avec Next.js 15 App Router. Frontend et backend cohabitent dans un seul projet, partageant les types TypeScript sans couche de traduction. Pour un POC de 5 jours en binôme, cela élimine la friction (CORS, double config, ports multiples) et maximise la vélocité.

| Couche | Technologie | Version | Rôle dans le projet |
|---|---|---|---|
| Framework fullstack | Next.js App Router | 15+ | Pages, API Routes, Server Components — tout dans un repo |
| Langage | TypeScript strict | 5.x | Typage bout en bout · types Prisma auto-générés · Zod sync |
| UI Components | Tailwind CSS + shadcn/ui | 4.x / latest | Design system prêt · composants accessibles · prototypage rapide |
| Graphiques | Recharts | 2.x | Librairie React native · API déclarative · responsive sans config |
| ORM & migrations | Prisma | 6.x | Type-safe · migrations déclaratives · switch SQLite→PG transparent |
| Base de données | SQLite (dev) / PostgreSQL (prod) | — | Zero config local · Neon/Supabase pour le déploiement |
| Intelligence artificielle | Anthropic Claude API | SDK TS 1.x | Extraction · scoring · estimation · génération de courriers |
| Authentification | NextAuth.js v5 | 5.x | Provider Credentials · JWT · middleware de protection des routes |
| Validation | Zod | 3.x | Schemas runtime + inférence TypeScript + intégration React Hook Form |
| Tests unitaires / intégration | Vitest + Testing Library | latest | Tests rapides · coverage · composants React |
| Tests E2E | Playwright | latest | Scénarios navigateur · cross-browser · CI-ready |
| Qualité | ESLint + Prettier + Husky | latest | Lint + format + hooks pre-commit automatiques |

### 5.2 Modèle de données — 7 entités

Le schéma capture l'intégralité du cycle de vie d'un sinistre, des données de l'assuré jusqu'aux résultats IA et à l'audit trail.

| Entité | Rôle | Relations clés |
|---|---|---|
| `User` | Gestionnaire, manager ou admin avec rôle et statut | → Claim (assigné), Comment, AuditLog |
| `Policyholder` | Assuré avec contrat et véhicule associé | → Claim (1:N) |
| `Claim` | Sinistre — entité centrale du système | → Policyholder, User, Document, AIAnalysis, Comment, AuditLog |
| `Document` | Fichier joint au sinistre (photo, PV, facture) | → Claim (N:1) · suppression en cascade |
| `AIAnalysis` | Résultat d'un appel Claude (JSON + méta) | → Claim (N:1) · type, input, output, tokens, durée |
| `Comment` | Note interne horodatée, non visible de l'assuré | → Claim + User |
| `AuditLog` | Trace immuable de toute action sur le système | → Claim + User · action enum + détails JSON |

### 5.3 API REST — domaines et endpoints

| Domaine | Endpoints | Méthodes |
|---|---|---|
| Authentification | `/api/auth/signin` · `/api/auth/session` | POST · GET |
| Sinistres | `/api/claims` · `/api/claims/:id` · `/api/claims/:id/status` · `/api/claims/:id/assign` · `/api/claims/:id/analyze` | GET · POST · PATCH · DELETE |
| Assurés | `/api/policyholders` · `/api/policyholders/:id` | GET · POST · PATCH |
| Documents | `/api/claims/:id/documents` · `/api/documents/:id/download` | GET · POST · DELETE |
| Commentaires | `/api/claims/:id/comments` | GET · POST |
| Intelligence Artificielle | `/api/ai/extract` · `/api/ai/fraud` · `/api/ai/estimate` · `/api/ai/letter` | POST |
| Dashboard | `/api/dashboard/stats` · `/api/dashboard/charts/timeline` · `/api/dashboard/recent` | GET |
| Administration | `/api/admin/users` · `/api/admin/audit-logs` · `/api/admin/export` | GET · POST · PATCH |

### 5.4 Matrice des permissions

| Action | Gestionnaire | Manager | Admin |
|---|---|---|---|
| Voir les sinistres | Ses dossiers assignés | Tous | Tous |
| Créer un sinistre | ✓ | ✓ | ✓ |
| Modifier un sinistre | Ses dossiers | Tous | Tous |
| Approuver / Rejeter | — | ✓ | ✓ |
| Lancer l'analyse IA | ✓ | ✓ | ✓ |
| Voir le dashboard | Vue limitée (ses KPIs) | Vue complète | Vue complète |
| Gérer les utilisateurs | — | — | ✓ |
| Configurer les seuils | — | — | ✓ |
| Consulter l'audit log | — | Lecture | Lecture + export |

### 5.5 Variables d'environnement requises

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="votre-secret-ici"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="[CLE_API_ANTHROPIC]"
```

---

## 6. Intégration IA — Design des Appels Claude

Les quatre fonctions IA sont des appels distincts à Claude API, chacun avec un prompt système spécialisé. Ils peuvent être appelés individuellement ou orchestrés via `POST /api/claims/:id/analyze`.

### 6.1 Extraction d'informations

| Paramètre | Valeur |
|---|---|
| Modèle | `claude-sonnet-4-6` |
| Max tokens | 2 048 |
| Format sortie | JSON strict (pas de texte libre) |
| Champs extraits | date, heure, lieu, véhicules (rôle/marque/dommages), blessures, tiers, dépôt plainte, météo, lacunes détectées |
| Règle clé | Ne jamais inventer de donnée non présente dans la description |
| Performance cible | < 10 secondes · 95 %+ de précision sur champs explicites |

### 6.2 Scoring de fraude

| Paramètre | Valeur |
|---|---|
| Modèle | `claude-sonnet-4-6` |
| Max tokens | 1 024 |
| Format sortie | `{ score, risk, factors[], summary, recommendation }` |
| Seuils d'action | < 30 normal · 31-70 vérification · > 70 escalade auto · > 80 blocage |
| Principe éthique | Score élevé = "à approfondir", jamais "fraudeur" — pas de présomption de culpabilité |
| Performance cible | Détecter 85 %+ des cas suspects identifiés par les experts |

### 6.3 Estimation d'indemnisation

| Paramètre | Valeur |
|---|---|
| Modèle | `claude-sonnet-4-6` |
| Max tokens | 1 024 |
| Format sortie | `{ estimatedTotal, breakdown: {parts, labor, other}, franchise, netEstimate, confidence }` |
| Référentiel | Barème assurance auto France 2025-2026 (cf. section 4.3) |
| Niveaux de confiance | `low` (infos insuffisantes) · `medium` (infos partielles) · `high` (infos complètes) |
| Résultat affiché | Fourchette min/max/probable + ventilation par poste + franchise déduite |

### 6.4 Génération de courriers

| Type de courrier | Déclencheur | Contenu généré |
|---|---|---|
| Accusé de réception | Soumission du sinistre | Confirmation + numéro dossier + prochaines étapes |
| Demande de pièces | Lacunes détectées (extraction IA) | Liste précise des documents manquants |
| Notification d'approbation | Statut → APPROVED | Montant validé + délai de versement + coordonnées |
| Notification de refus | Statut → REJECTED | Motif détaillé + voies de recours + délai contestation |
| Demande d'information | Manuel (gestionnaire) | Formulation adaptée au contexte du dossier |

> Tous les courriers sont générés en français soutenu, personnalisés avec le nom de l'assuré et le numéro de sinistre, et limités à 300 mots. Ils sont présentés en aperçu avant envoi — le gestionnaire garde la main.

---

## 7. Plan de Livraison — Sprint 5 Jours

### 7.1 Vue d'ensemble

| Jour | Thème | Livrable Dev A | Livrable Dev B | Sync |
|---|---|---|---|---|
| J1 | Setup & Fondations | Projet init · schéma DB migré · seed 10 sinistres | Layout · routing · auth NextAuth fonctionnelle | Validation schéma + contrat API (30 min) |
| J2 | API REST & UI base | API CRUD complète · tests d'intégration verts | ClaimsTable · ClaimFilters · ClaimForm 4 étapes | Démo croisée API + maquettes (30 min) |
| J3 | Intégration IA | 4 endpoints IA · orchestration · hooks pre-commit | 4 composants IA · MCP barèmes local | Intégration frontend ↔ backend (1h) |
| J4 | Dashboard & Refactoring | Dashboard API · workflow statuts · export CSV · refactoring ai.service | Dashboard Recharts · timeline · admin · refactoring ClaimForm | Revue composants IA dans l'UI (30 min) |
| J5 | Tests & Démo | Couverture > 60% · debugging · code review | 3 tests E2E Playwright · tests composants · scénario démo | Tests croisés (1h) + répétition démo |

### 7.2 Scénario de démo finale (15 minutes)

| Étape | Durée | Action démontrée | Valeur visible |
|---|---|---|---|
| 1. Login | 2 min | Julie se connecte → redirection automatique /claims | Rôles et accès différenciés |
| 2. Dashboard | 1 min | Vue d'ensemble KPIs + graphiques Recharts | Pilotage managérial temps réel |
| 3. Déclaration | 3 min | Formulaire 4 étapes + upload 2 photos | Guidage structuré < 3 min |
| 4. Analyse IA | 3 min | Extraction auto + score fraude 72 (alerte !) + estimation | IA augmentant le gestionnaire |
| 5. Workflow | 2 min | Escalade automatique → Marc approuve | Règles métier automatisées |
| 6. Courrier | 2 min | Génération courrier d'approbation en 1 clic | 0 rédaction manuelle |
| 7. Export | 2 min | Marc exporte CSV des statistiques filtrées | Données librement exportables |

---

## 8. Qualité & Critères d'Évaluation

### 8.1 Exigences qualité non-négociables

- TypeScript strict : zéro usage de `any`, types inférés depuis Prisma et Zod
- Validation Zod sur 100 % des endpoints API (entrées et sorties)
- Gestion d'erreurs explicite : codes HTTP corrects, messages d'erreur lisibles
- Audit trail complet : toute modification de statut et tout appel IA logguée
- Couverture de tests > 60 % (mesurée par Vitest coverage)
- 3 scénarios E2E Playwright passants : login, création sinistre, dashboard

### 8.2 Grille d'évaluation

| Critère | Poids | Ce qui est mesuré |
|---|---|---|
| Fonctionnalités livrées | 40 % | Toutes les US des épics 1–4 (priorité HAUTE) fonctionnelles et connectées |
| Qualité du code | 20 % | TypeScript strict · séparation des responsabilités · pas d'antipatterns |
| Tests | 15 % | Couverture > 60 % · 3 tests E2E verts · tests composants critiques |
| Utilisation Claude Code | 15 % | 14 fonctionnalités exercées avec preuve dans l'historique Claude Code |
| Démo | 10 % | Scénario fluide 15 min · réponses aux questions · cas de fraude illustré |

### 8.3 Checklist Claude Code — 14 fonctionnalités

| # | Fonctionnalité | Jour | Exercice concret |
|---|---|---|---|
| 1 | Scaffolding | J1 | Bootstrap Next.js 15 complet en une commande guidée |
| 2 | Plan mode | J1 | Conception schéma DB + layout UI avant tout code |
| 3 | Code generation | J1–J5 | Composants, services, API routes générés à la demande |
| 4 | TDD | J2 | Tests `GET /api/claims` écrits AVANT l'implémentation |
| 5 | Debugging | J2, J5 | 3 bugs volontaires introduits et corrigés avec Claude |
| 6 | Agent Teams | J3 | 4 agents en parallèle pour générer les prompts IA |
| 7 | MCP Servers | J3 | MCP local exposant les barèmes d'indemnisation |
| 8 | Hooks | J3 | Pre-commit vérifiant le format des prompts Claude |
| 9 | Multi-file edit | J4 | Refactoring `ai.service.ts` → 4 fichiers distincts |
| 10 | Refactoring | J4 | `ClaimForm` 400 lignes → 4 sous-composants d'étape |
| 11 | Code review | J5 | `/review` backend complet · identification failles sécu |
| 12 | /commit | J5 | Commit conventionnel avec message généré par Claude |
| 13 | Tests E2E | J5 | 3 scénarios Playwright : login, création, dashboard |
| 14 | Tests composants | J5 | Testing Library sur ClaimForm, FraudScoreCard, StatsCard |

---

## 9. Risques & Points d'Attention

### 9.1 Matrice des risques

| Risque | Probabilité | Impact | Mitigation recommandée |
|---|---|---|---|
| Clé API Anthropic non disponible au J3 | Moyenne | Bloquant | Provisionner `ANTHROPIC_API_KEY` avant J2 · tester avec un appel simple dès J1 |
| Périmètre trop large pour 5 jours | Élevée | Fort | Traiter épics 1–4 comme MVP absolu · épics 5–6 en best-effort uniquement |
| SQLite limitations (enums, JSON) | Certaine | Faible | Enums en String (Prisma gère) · champs JSON sérialisés en String · migration PG transparente |
| Coordination binôme (contrat API) | Moyenne | Moyen | Générer `src/types/` partagés dès le sync J1 · ne jamais casser les types sans prévenir |
| Agent Teams J3 complexe à configurer | Moyenne | Moyen | Prévoir 1h dédiée · tester d'abord chaque agent seul · puis en parallèle |
| Couverture tests < 60 % en fin de J5 | Moyenne | Évaluation | Écrire tests au fil de l'eau (J2, J3) · ne pas tout reporter à J5 |
| Données de test incohérentes | Faible | Démo | Utiliser exclusivement le jeu du cahier des charges (plus riche, 3 cas fraude documentés) |

### 9.2 Extensions post-POC (bonus)

| Challenge | Valeur ajoutée | Points | Effort |
|---|---|---|---|
| Mode sombre (`next-themes`) | UX professionnelle · démo plus impactante | +2 | Facile |
| Notifications in-app | Alerte temps réel sur changement de statut | +3 | Moyen |
| Export PDF du sinistre (`@react-pdf/renderer`) | Rapport complet prêt à archiver | +3 | Moyen |
| Déploiement Vercel + Neon PG | POC accessible en ligne pour les démos clients | +2 | Moyen |
| MCP externe (API météo) | Contexte météo au moment du sinistre · enrichit le scoring | +4 | Difficile |
| Chatbot RAG sur les dossiers | Interroger les sinistres en langage naturel | +5 | Difficile |
| Claude Vision sur les photos | Analyse automatique des dommages visibles | +4 | Difficile |

---

*PRD v1.0 — Mars 2026 — session projet-claims — ClaimFlow AI / Leadmind AI*
