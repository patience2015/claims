#!/bin/bash
# Hook PreToolUse[Bash] — ClaimFlow safety guard
# Claude Code passe le contexte de l'outil en JSON sur stdin.
# Format : { "tool_name": "Bash", "tool_input": { "command": "..." } }
# Exit 2 = bloquer l'action. Tout texte ecrit sur stdout est montre a l'utilisateur.

input=$(cat 2>/dev/null)

# Extraire la commande depuis le JSON via Python (disponible dans l'env)
command=$(echo "$input" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null)

# Fallback : si Python echoue, grep sur le JSON brut
if [ -z "$command" ]; then
  command="$input"
fi

# Bloquer : prisma migrate reset sans --force
if echo "$command" | grep -qi "migrate reset" && ! echo "$command" | grep -qi "\-\-force"; then
  echo "BLOCK: 'prisma migrate reset' sans --force detecte."
  echo "Ajoutez --force pour confirmer la suppression de toutes les donnees."
  exit 2
fi

# Bloquer : git push --force
if echo "$command" | grep -qiE "git push.*(--force|-f\b)"; then
  echo "BLOCK: 'git push --force' bloque par hook ClaimFlow."
  echo "Confirmez explicitement si vous etes certain de vouloir forcer le push."
  exit 2
fi

# Bloquer : rm -rf sur repertoires critiques du projet
if echo "$command" | grep -qiE "rm -rf.*(claimflow|/prisma|/src|\.next|node_modules)"; then
  echo "BLOCK: 'rm -rf' sur un repertoire critique du projet detecte. Operation bloquee."
  exit 2
fi

exit 0
