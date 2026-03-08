# ClaimFlow AI — Guide utilisateur

Plateforme de gestion des sinistres automobiles augmentée par IA.

---

## Démarrage rapide

```bash
cd /c/projets/claims/claimflow
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Qui se connecte où ?

### Assuré (Policyholder)
> Je veux consulter mon sinistre ou accepter une proposition d'indemnisation

**URL de connexion** → `http://localhost:3000/portail/login`

**Identifiants** : numéro de police + adresse email (pas de mot de passe classique)

Exemple de comptes seedés :
| Numéro de police | Email |
|-----------------|-------|
| POL-2024-001 | alice.martin@email.fr |
| POL-2024-002 | bob.dupont@email.fr |
| POL-2024-003 | claire.bernard@email.fr |

**Ce que l'assuré peut faire :**
1. `Mes sinistres` — liste de tous ses sinistres avec statut
2. `Détail sinistre` — voir les documents, l'avancement, le montant proposé
3. `Ajouter un document` — uniquement si le sinistre est en statut `SUBMITTED`, `UNDER_REVIEW` ou `INFO_REQUESTED`
4. `Accepter / Refuser` — uniquement si le sinistre est `APPROVED` avec un montant validé

---

### Gestionnaire (Handler)
> Je traite les sinistres au quotidien

**URL de connexion** → `http://localhost:3000/login`

| Email | Mot de passe |
|-------|-------------|
| julie@claimflow.ai | password123 |

**Après connexion**, redirection automatique vers `/claims`

**Ce que le gestionnaire peut faire :**

| Page | URL | Action |
|------|-----|--------|
| Liste des sinistres | `/claims` | Filtrer par statut/type, rechercher, paginer |
| Nouveau sinistre | `/claims/new` | Formulaire 4 étapes (déclaration + upload) |
| Fiche sinistre | `/claims/[id]` | Voir détails, déclencher l'IA, changer statut |
| Analyse IA | dans `/claims/[id]` | Extraction auto, score fraude, estimation montant |
| Générer un courrier | dans `/claims/[id]` | Courrier personnalisé via Claude AI |
| Ajouter un commentaire | dans `/claims/[id]` | Notes internes (non visibles par l'assuré) |
| Ajouter un document | dans `/claims/[id]` | Upload PDF/JPG/PNG (max 10 Mo) |
| Notifications | `/notifications` | Toutes les alertes reçues |
| Préférences notif | `/notifications/preferences` | Activer/désactiver par type |

---

### Manager
> Je pilote l'équipe et surveille les fraudes

**URL de connexion** → `http://localhost:3000/login`

| Email | Mot de passe |
|-------|-------------|
| marc@claimflow.ai | password123 |

**Après connexion**, redirection automatique vers `/dashboard`

**Ce que le manager peut faire** (tout ce que fait le gestionnaire +) :

| Page | URL | Action |
|------|-----|--------|
| Dashboard | `/dashboard` | KPIs, charts tendances, SLA, répartitions |
| Réseaux suspects | `/fraud-networks` | Liste des clusters de fraude détectés |
| Détail réseau | `/fraud-networks/[id]` | Graphe D3.js, sinistres liés, historique |
| Escalader un réseau | dans `/fraud-networks/[id]` | Passer en `UNDER_INVESTIGATION` |
| Classer sans suite | dans `/fraud-networks/[id]` | Passer en `DISMISSED` |

---

### Administrateur
> Je gère les utilisateurs et la configuration

**URL de connexion** → `http://localhost:3000/login`

| Email | Mot de passe |
|-------|-------------|
| thomas@claimflow.ai | password123 |

**Après connexion**, redirection automatique vers `/admin`

**Ce que l'admin peut faire** (tout ce que fait le manager +) :

| Page | URL | Action |
|------|-----|--------|
| Admin | `/admin` | Liste des utilisateurs, créer/modifier/désactiver |
| Recalcul réseaux | API `/api/fraud-networks/recompute` | Relancer l'algorithme Union-Find sur tous les sinistres |

---

## Parcours typiques

### Déclarer un nouveau sinistre (Gestionnaire)
1. Se connecter avec `julie@claimflow.ai`
2. Cliquer **"Nouveau sinistre"** (bouton `+` en haut à droite de `/claims`)
3. **Étape 1** — Informations de base (type, date, lieu, description)
4. **Étape 2** — Véhicule assuré (immatriculation, assuré)
5. **Étape 3** — Détails de l'incident (circonstances, tiers)
6. **Étape 4** — Upload des documents (PV, photos, devis)
7. Le sinistre est créé en statut `SUBMITTED` avec un numéro `CLM-YYYY-NNNNN`

### Analyser un sinistre avec l'IA
1. Ouvrir un sinistre depuis `/claims`
2. Cliquer **"Analyser avec l'IA"** dans le panneau latéral
3. L'IA extrait automatiquement les données, calcule le score de fraude (0–100) et propose un montant d'indemnisation
4. Le score s'affiche dans `FraudScoreCard` avec les facteurs explicatifs
5. Si score > 70 → escalade automatique au manager

### Consulter un sinistre en tant qu'assuré
1. Aller sur `http://localhost:3000/portail/login`
2. Saisir numéro de police (ex: `POL-2024-001`) et email (`alice.martin@email.fr`)
3. La liste `/portail/mes-sinistres` affiche tous ses sinistres
4. Cliquer sur un sinistre → voir statut, documents, montant proposé
5. Si statut `APPROVED` et montant renseigné → bouton **Accepter** ou **Refuser** (motif obligatoire ≥ 20 caractères)

### Investiguer un réseau de fraude (Manager)
1. Se connecter avec `marc@claimflow.ai`
2. Menu **"Réseaux suspects"** dans la navbar
3. Filtrer par statut (`SUSPECT`, `CRITICAL`, `UNDER_INVESTIGATION`)
4. Cliquer sur un réseau → onglet **Graphe** pour visualiser les connexions D3.js
5. Onglet **Sinistres** → liste des dossiers impliqués avec liens directs
6. Onglet **Historique** → audit trail des actions sur ce réseau
7. Bouton **Escalader** → passe en investigation + sinistres actifs passent en `UNDER_REVIEW`

---

## Workflow des statuts de sinistre

```
SUBMITTED
    ↓ (gestionnaire ouvre le dossier)
UNDER_REVIEW
    ↓ (si des infos manquent)
INFO_REQUESTED ←→ UNDER_REVIEW
    ↓ (décision prise)
APPROVED ──────────────────────→ REJECTED
    ↓ (assuré accepte/refuse)
CLOSED
```

| Statut | Qui peut changer | Vers |
|--------|-----------------|------|
| SUBMITTED | HANDLER / MANAGER | UNDER_REVIEW |
| UNDER_REVIEW | HANDLER / MANAGER | INFO_REQUESTED, APPROVED, REJECTED |
| INFO_REQUESTED | HANDLER / MANAGER | UNDER_REVIEW |
| APPROVED | Assuré (portail) | CLOSED |
| REJECTED | — | CLOSED (automatique) |

---

## Notifications

Le badge cloche dans la navbar affiche le nombre de notifications non lues.

Types d'alertes reçues :
| Type | Déclencheur |
|------|------------|
| Sinistre assigné | Un sinistre vous est assigné |
| Changement de statut | Le statut d'un sinistre a changé |
| Document uploadé | L'assuré a déposé un document |
| Alerte fraude | Score fraude élevé détecté |
| Alerte réseau | Nouveau cluster de fraude |
| Réseau escaladé | Un réseau passe en investigation |
| SLA | Sinistre sans mouvement depuis 30 jours |

Gérer ses préférences → `/notifications/preferences`
