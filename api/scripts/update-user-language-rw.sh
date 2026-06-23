#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Updating all users to language = rw..."
echo

pnpm exec prisma db execute --stdin <<'SQL'
-- Existing settings: set language to Kinyarwanda
UPDATE "UserSettings"
SET
  language = 'rw',
  "updatedAt" = NOW()
WHERE language IS DISTINCT FROM 'rw';

-- Users without a settings row: create one with rw
INSERT INTO "UserSettings" (
  id,
  "userId",
  theme,
  language,
  timezone,
  "dateFormat",
  "emailNotif",
  "pushNotif",
  "smsNotif",
  categories,
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  u.id,
  'light',
  'rw',
  'Africa/Kigali',
  'DD/MM/YYYY',
  true,
  true,
  false,
  '{"courseUpdates":true,"assignmentReminders":true,"certificates":true,"systemUpdates":false}'::jsonb,
  NOW(),
  NOW()
FROM "User" u
LEFT JOIN "UserSettings" us ON us."userId" = u.id
WHERE us.id IS NULL;
SQL

echo
echo "Done. All UserSettings rows now use language = rw."
echo "Users who had no settings row were given a new row with rw."
