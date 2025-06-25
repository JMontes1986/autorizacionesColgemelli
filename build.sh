#!/bin/bash
set -euo pipefail

: "https://mbosvnmhnbrslfwlfcxu.supabase.co"
: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ib3N2bm1obmJyc2xmd2xmY3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1ODU2MzUsImV4cCI6MjA2NTE2MTYzNX0.evgs5gWsCRyfeo273tLiAAoIdB-IjMaPq8U23xK4lqc"

cat > env.js <<EOL
window.process = { env: {
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}"
}};
EOL

echo "env.js generado"
