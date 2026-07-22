/**
 * Update all users with role CHO → CEHO.
 *
 * RoleType is a Postgres enum used by UserRole.name, Student.role, and Staff.role.
 * Renaming the enum value in place updates every row automatically (same approach
 * as prisma/migrations/20260718210000_rename_cho_to_ceho).
 *
 * Uses dotenv (not `source .env`) so multiline / unquoted secrets in .env do not break.
 *
 *   pnpm run update:cho-to-ceho
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function enumHasLabel(label: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'RoleType' AND e.enumlabel = ${label}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function main() {
  const hasCho = await enumHasLabel("CHO");
  const hasCeho = await enumHasLabel("CEHO");

  console.log(`RoleType has CHO=${hasCho}, CEHO=${hasCeho}`);

  if (hasCho && !hasCeho) {
    console.log("Renaming RoleType enum value CHO → CEHO...");
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "RoleType" RENAME VALUE 'CHO' TO 'CEHO'`,
    );
    console.log("Enum rename complete (UserRole / Student / Staff updated).");
  } else if (hasCho && hasCeho) {
    console.log("Both CHO and CEHO exist. Updating rows that still use CHO...");
    const ur = await prisma.$executeRaw`
      UPDATE "UserRole" SET name = 'CEHO' WHERE name::text = 'CHO'
    `;
    const st = await prisma.$executeRaw`
      UPDATE "Student" SET role = 'CEHO' WHERE role::text = 'CHO'
    `;
    const sf = await prisma.$executeRaw`
      UPDATE "Staff" SET role = 'CEHO' WHERE role::text = 'CHO'
    `;
    console.log(`Updated UserRole=${ur}, Student=${st}, Staff=${sf}`);
  } else if (hasCeho) {
    console.log("Already CEHO only — nothing to rename.");
  } else {
    throw new Error("RoleType has neither CHO nor CEHO — unexpected schema state");
  }

  const users = await prisma.$queryRaw<
    { id: string; fullNames: string; email: string; role: string }[]
  >`
    SELECT u.id, u."fullNames", u.email, ur.name::text AS role
    FROM "UserRole" ur
    JOIN "User" u ON u.id = ur."userId"
    WHERE ur.name::text = 'CEHO'
    ORDER BY u."fullNames"
  `;

  console.log(`\nCEHO users (${users.length}):`);
  for (const u of users) {
    console.log(`  ${u.fullNames} <${u.email}> [${u.id}]`);
  }

  console.log("\nDone.");
  console.log(
    "If CHOGroup tables still exist on this DB, also run: pnpm run migrate:deploy",
  );
}

main()
  .catch((err) => {
    console.error("update:cho-to-ceho failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
