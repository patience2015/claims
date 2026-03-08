#!/bin/bash
# Hook PostToolUse[Edit|Write] — ClaimFlow reminder
# Claude Code passe le contexte de l'outil en JSON sur stdin.
# Format : { "tool_name": "Edit", "tool_input": { "file_path": "..." } }

input=$(cat 2>/dev/null)

# Extraire le chemin du fichier modifie via Python
file_path=$(echo "$input" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null)

# Fallback : grep sur le JSON brut
if [ -z "$file_path" ]; then
  file_path="$input"
fi

# schema.prisma modifie → rappel migration
if echo "$file_path" | grep -qi "schema\.prisma"; then
  echo ""
  echo "RAPPEL ClaimFlow : schema.prisma modifie"
  echo "  Lancez /migrate ou :"
  echo "  DATABASE_URL=\"file:./dev.db\" npx prisma migrate dev --name <nom>"
fi

# validations.ts modifie → rappel coherence types
if echo "$file_path" | grep -qi "validations\.ts"; then
  echo ""
  echo "validations.ts modifie — verifiez la coherence avec src/types/index.ts"
fi

# route.ts modifie → checklist API
if echo "$file_path" | grep -qiE "api/.*route\.ts"; then
  echo ""
  echo "Route API modifiee — checklist : auth() + Zod safeParse() + createAuditLog() sur mutations"
fi

exit 0
