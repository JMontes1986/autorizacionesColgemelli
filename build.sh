#!/bin/bash
set -euo pipefail

"${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"

cat > env.js <<EOL
window.process = {
  env: {
    SUPABASE_URL: "$SUPABASE_URL",
    SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY"
  }
};
EOL

echo "env.js generado"
exit 0
