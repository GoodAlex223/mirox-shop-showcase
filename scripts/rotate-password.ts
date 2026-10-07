/**
 * Rotate one account's password.
 *
 * This app has no password-change endpoint or UI anywhere (verified G17), so a
 * compromised credential can only be rotated against the database. Written for
 * G17 finding F1: the seeded admin password was published in the public README,
 * making it a live admin login for anyone who read the repository.
 *
 * Usage:
 *   ROTATE_EMAIL=admin@store.com npm run db:rotate-password
 *     -> generates a strong password and prints it once
 *
 *   ROTATE_EMAIL=admin@store.com ROTATE_PASSWORD='your-choice' npm run db:rotate-password
 *     -> sets the password you chose
 *
 * Against production, point DATABASE_URL at the prod database for the one
 * command. This script only ever updates a single passwordHash: it creates
 * nothing, deletes nothing, and touches no other row.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12; // matches prisma/seed.ts
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ROTATE_EMAIL?.trim();
  if (!email) {
    throw new Error("ROTATE_EMAIL is required, e.g. ROTATE_EMAIL=admin@store.com");
  }

  const supplied = process.env.ROTATE_PASSWORD?.trim();
  const password = supplied || randomBytes(24).toString("base64url");

  if (password.length < 12) {
    throw new Error("ROTATE_PASSWORD must be at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!existing) {
    throw new Error(`No account with email "${email}" — nothing was changed.`);
  }

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "(unparsable DATABASE_URL)";
    }
  })();

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(password, SALT_ROUNDS) },
  });

  console.log(`\nRotated password for ${existing.email} (${existing.role}) on host "${host}".`);
  if (supplied) {
    console.log("Used the password supplied in ROTATE_PASSWORD.");
  } else {
    console.log("\n  New password (shown once — store it now):\n");
    console.log(`      ${password}\n`);
  }
  console.log("Old password no longer works. Sign in to confirm before closing this terminal.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(`\n${e instanceof Error ? e.message : e}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
