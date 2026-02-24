#!/bin/bash
set -euo pipefail

GROQ_API_KEY="${GROQ_API_KEY:-}"

cat > env.js <<EOL
window.process = {
  env: {
    SUPABASE_URL: "$SUPABASE_URL",
    SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY",
    GROQ_API_KEY: "$GROQ_API_KEY"
  }
};
EOL

VERSION=$(node -p "require('./package.json').version")
BUILD=$(git rev-list --count HEAD)

cat > version.js <<EOF
window.APP_VERSION = { version: "$VERSION", build: "$BUILD" };
EOF

echo "env.js generado"
echo "version.js generado con v$VERSION build $BUILD"
exit 0
