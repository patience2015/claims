Contexte optionnel (feature, fix, scope…) :
$ARGUMENTS

---

Effectue un commit conventionnel, fetch + rebase, puis push.

### 1. Analyse des changements

Exécuter en parallèle :
- `git -C /c/projets/claims status`
- `git -C /c/projets/claims diff HEAD`
- `git -C /c/projets/claims log --oneline -5`

Si aucun changement détecté → informer l'utilisateur et s'arrêter.

### 2. Message de commit

Construire un message **conventionnel** à partir des fichiers modifiés et du contexte fourni dans $ARGUMENTS :

```
<type>(<scope>): <sujet court en français>

<body — pourquoi ce changement, ce qui a été modifié>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Types** : `feat` · `fix` · `refactor` · `test` · `chore` · `docs`
**Scopes** : `auth` · `claims` · `ai` · `dashboard` · `admin` · `tests` · `mcp` · `agents` · `hooks`

Règles :
- Sujet < 72 caractères, impératif présent
- Body : expliquer le "pourquoi", pas le "quoi"
- Ne jamais inclure `.env`, `.env.local`, secrets

### 3. Staging + Commit

```bash
git -C /c/projets/claims add -A
git -C /c/projets/claims commit -m "$(cat <<'EOF'
<message construit>
EOF
)"
```

### 4. Fetch + Rebase

```bash
git -C /c/projets/claims fetch origin
git -C /c/projets/claims rebase origin/<branche-courante>
```

Si le rebase produit des conflits → les afficher clairement et demander résolution avant de continuer.

### 5. Push

```bash
git -C /c/projets/claims push origin <branche-courante>
```

### 6. Confirmation

Afficher :
```
Commit  : <type>(<scope>): <sujet>
Branche : <nom>
Push    : OK
```
