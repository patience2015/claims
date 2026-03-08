
# ClaimFlow AI — Workflow Agents & PRD Étendu

## 1. Introduction
Ce document décrit le PRD étendu intégrant :
- un Agent BA (Business Analyst) capable de transformer une user story en spécifications détaillées,
- un Agent Architecte capable d’analyser ces specs et de produire un plan d’implémentation orchestré pour les équipes de développement,
- un workflow complet permettant de passer de la user story → specs → architecture → tâches → exécution,
- un workflow partiel permettant de traiter uniquement une partie du processus.

## 2. Rôles & Agents

### 2.1 Agent BA — Business Analyst
**Objectif :** Transformer une User Story en spécifications fonctionnelles exploitables par les développeurs.

**Entrée :** `User Story` (ex: "En tant que gestionnaire, je veux...")
**Sortie :**
- Règles métier complètes
- Critères d’acceptation
- Cas limites
- Flux métier (diagramme textuel)
- Données nécessaires / impact sur le modèle de données
- Risques & contraintes

**Format demandé :** JSON structuré + version markdown.

---

### 2.2 Agent Architecte — Analyse & Orchestration Technique
**Objectif :** Traduire les specs du BA en:
- Architecture technique
- Découpage en services / modules
- Contrats API
- Mise à jour du schéma Prisma
- Tâches par équipe (Backend, Frontend, IA, QA)
- Évaluation de la complexité
- Dépendances entre tâches

**Sortie :**
- Plan d’implémentation en plusieurs phases
- Tâches découpées avec granularité type Jira
- Graph orienté des dépendances

---

### 2.3 Agent Dev Backend
Basé sur le plan de l’architecte, génère :
- Endpoints API
- Schemas Zod
- Migrations Prisma
- Services (IA, business, audit, workflow)

### 2.4 Agent Dev Frontend
Génère :
- Pages Next.js
- Composants React
- Intégration API
- Validation UI

### 2.5 Agent IA Engineer
Gère :
- Prompts système
- Orchestration IA
- Agent Teams

### 2.6 Agent QA & Tests
Gère :
- TDD backend
- Tests composants
- Tests E2E
- Détection erreurs auto

---

## 3. Workflow Complet

```
User Story → Agent BA → Specs → Agent Architecte → Architecture + Tasks → Agents Dev
Backend/Frontend/IA/QA → Code → Tests → Livraison
```

### Explication détaillée
1. **User Story fournie par l’utilisateur**
2. **Agent BA** génère specs détaillées
3. **Agent Architecte** génère découpage technique + tâches
4. **Agents Dev** implémentent selon leur domaine
5. **Agent QA** valide & renvoie anomalies
6. **Boucle jusqu’à conformité**

---

## 4. Workflow Partiel
Possible de déclencher uniquement une étape :
- _/BA_ → transformer une user story seulement
- _/architect_ → produire uniquement la partie architecture
- _/backend_, _/frontend_, _/ia_, _/qa_ → implémentation ciblée

---

## 5. Commandes utilisables (Claude Code)

### 5.1 User Story → Specs (BA)
```
/ba
Voici la user story : "En tant que ...".
Analyse-la et produis : specs, règles métier, critères d’acceptation, cas limites, flux + impacts données.
```

### 5.2 Specs → Architecture (Architecte)
```
/architect
Voici les specs générées par le BA :
<coller ici>
Génère le plan technique, l’architecture, les tâches, les dépendances et les contrats API.
```

### 5.3 Architecture → Implémentation Backend
```
/backend
Voici le plan technique fourni par l’architecte.
Génère le code backend complet (Prisma, API, services, validations).
```

### 5.4 Architecture → Implémentation Frontend
```
/frontend
Voici les specs et l’architecture.
Génère pages, composants, UI, validations, intégration API.
```

### 5.5 Implémentation IA
```
/ia
Créer les prompts, agent teams, endpoints IA et orchestration.
```

### 5.6 QA
```
/qa
Génère tests TDD, E2E Playwright, Tests React.
```

---

## 6. Exemple de flux complet
### User Story exemple
> En tant que gestionnaire, je veux saisir un sinistre avec un formulaire en 4 étapes afin d’enregistrer toutes les informations requises.

### BA produit
- Règles métier
- Critères d’acceptation Gherkin
- Cas limites (documents invalides, valeurs manquantes)
- Flux textuel
- Modèle de données impacté

### Architecte produit
- Découpage en 6 modules
- Schéma Prisma mis à jour
- API : POST /claims, validation
- Tâches pour Backend + Frontend + IA

### Dev → Code
### QA → Tests

---

# Fin du Document
