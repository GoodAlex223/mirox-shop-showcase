// User seed data
//
// Seed accounts carry NO password literal. G17 finding F1 (HIGH, confirmed 3/3):
// the former hard-coded `password` field was bcrypt-hashed into an unconditional
// Role.ADMIN upsert and republished in this PUBLIC repo's README, which made it
// a live production admin login for anyone who read the repository. Passwords
// now come from the environment via resolveSeedPassword() below.

export const adminUser = {
  email: "admin@store.com",
  name: "Адміністратор Mirox",
};

export const testCustomers = [
  {
    email: "customer@example.com",
    name: "Олександр Петренко",
  },
  {
    email: "sarah.wilson@example.com",
    name: "Дмитро Коваленко",
  },
  {
    email: "mike.johnson@example.com",
    name: "Марія Шевченко",
  },
  {
    email: "emily.chen@example.com",
    name: "Ірина Бондаренко",
  },
];

type ResolveOptions = {
  /** Whether DATABASE_URL points at a local host (see assertLocalDatabase in seed.ts). */
  isLocalHost: boolean;
  /** Source of a fresh random password; injected so the resolver stays pure. */
  generate: () => string;
  /** Env var named in the failure message. */
  envVar?: string;
};

/**
 * Decide which password the seed should hash for a seeded account.
 *
 * Local development gets a generated password when the env var is unset, so
 * `npm run db:seed` still works with no setup. A non-local target must name the
 * password explicitly: seeding a remote database with a password nobody chose
 * is how an unrotatable account gets planted, which is exactly what F1 was.
 */
export function resolveSeedPassword(
  envValue: string | undefined,
  { isLocalHost, generate, envVar = "SEED_ADMIN_PASSWORD" }: ResolveOptions
): string {
  const supplied = envValue?.trim();
  if (supplied) return supplied;

  if (!isLocalHost) {
    throw new Error(
      `${envVar} is required when seeding a non-local database. ` +
        "Set it to a password you have chosen and can rotate; the seed will not invent one."
    );
  }

  return generate();
}
