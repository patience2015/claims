Branche cible (optionnel — défaut : branche courante) :
$ARGUMENTS

---

## Synchronisation avec GitHub

Récupère les derniers changements du dépôt distant et met à jour le code local.

### 1. État initial

Exécuter en parallèle :
- `git -C /c/projets/claims status --short`
- `git -C /c/projets/claims log --oneline -3`
- `git -C /c/projets/claims branch -vv`

### 2. Stash des changements locaux non commités

Si des fichiers modifiés sont détectés (hors `.next/`, `node_modules/`) :
```bash
git -C /c/projets/claims stash push -m "sync-stash-$(date +%Y%m%d-%H%M%S)"
```
Noter le stash créé pour le restaurer après.

### 3. Fetch + Rebase (ou pull si pas de commits locaux)

```bash
git -C /c/projets/claims fetch origin
```

Si des commits locaux non poussés existent → rebase :
```bash
git -C /c/projets/claims rebase origin/<branche-courante>
```

Sinon → fast-forward :
```bash
git -C /c/projets/claims merge --ff-only origin/<branche-courante>
```

Si la branche cible fournie en argument est différente de la courante :
```bash
git -C /c/projets/claims checkout <branche-cible>
git -C /c/projets/claims merge --ff-only origin/<branche-cible>
```

**En cas de conflit rebase** → afficher les fichiers en conflit et demander résolution avant de continuer.

### 4. Restauration du stash

Si un stash a été créé à l'étape 2 :
```bash
git -C /c/projets/claims stash pop
```

En cas de conflit stash → afficher les fichiers impactés et demander.

### 5. Rapport final

Afficher :
```
Branche  : <nom>
Commits  : +X nouveau(x) commit(s) récupéré(s)
Stash    : restauré / aucun
Statut   : À jour ✓
```

Puis lister les fichiers modifiés par les nouveaux commits (si applicable) :
```bash
git -C /c/projets/claims diff HEAD~X HEAD --name-only
```
