#!/usr/bin/env bash
# scripts/seed-demo-data.sh — seed the AegisBank demo data (Doc 3 Part K step 12).
# Usage: ./scripts/seed-demo-data.sh
# Runs the Prisma seed in the backend (or, in the sandbox, the Next.js project).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f "prisma/seed.ts" ] && [ -f "package.json" ] && grep -q '"next"' package.json 2>/dev/null; then
  # Next.js sandbox layout
  echo "→ seeding (sandbox layout)…"
  bun run db:seed
else
  # Spec layout (backend/prisma/seed.ts)
  cd backend
  npx prisma db seed
fi

echo "✓ demo data seeded"
echo "  admin:    admin@aegisbank.demo / Admin@12345"
echo "  customer: alice@aegisbank.demo / Alice@12345"
echo "  customer: bob@aegisbank.demo / Bob@12345"
