#!/usr/bin/env bash
# scripts/run-migrations.sh — run Prisma migrations (Doc 3 Part H).
# Locally uses `prisma migrate dev`; in production/CI uses `migrate deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-dev}"

if [ -f "prisma/schema.prisma" ] && [ -f "package.json" ] && grep -q '"next"' package.json 2>/dev/null; then
  # Next.js sandbox — uses db:push (SQLite)
  echo "→ sandbox: prisma db push"
  bun run db:push
else
  cd backend
  if [ "$MODE" = "deploy" ]; then
    echo "→ production: prisma migrate deploy"
    npx prisma migrate deploy
  else
    echo "→ local: prisma migrate dev"
    npx prisma migrate dev --name init
  fi
fi
echo "✓ migrations applied"
