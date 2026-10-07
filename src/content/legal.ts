/**
 * Legal-entity configuration for the public offer, privacy policy and return
 * policy (G23 spec §3).
 *
 * Deliberately dependency-free, like brand.ts: these constants are read by
 * Server Components and may later be read by API routes.
 */

export interface LegalEntity {
  /** Drives the requisites heading and the offer's party clause. */
  form: "ФОП" | "ТОВ";
  /** Full registered name, e.g. «ФОП Прізвище Ім'я По-батькові». */
  name: string;
  /** ЄДРПОУ (ТОВ) or РНОКПП/ІПН (ФОП). */
  edrpou: string;
  /** Registered address exactly as it appears in the state register. */
  address: string;
  /** Official contact address. Omit until a real domain exists. */
  email?: string;
}

/**
 * CLIENT-SUPPLIED, PENDING: the seller's registered identity.
 *
 * `null` is a supported production state, not a TODO. <SellerRequisites/>
 * renders the brand + contact fallback instead of a requisites table, so the
 * legal pages publish today and light up with no code change once the
 * seller's requisites are filled in. Never fill this with example or placeholder data —
 * a fabricated ЄДРПОУ on a public offer is worse than an absent one.
 */
export const LEGAL_ENTITY: LegalEntity | null = null;

/**
 * USER-APPROVED 2026-07-28. Matches ЗУ «Про захист прав споживачів» ст. 9,
 * which grants 14 days to return non-food goods of proper quality.
 */
export const RETURN_WINDOW_DAYS = 14;
