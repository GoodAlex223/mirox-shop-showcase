/**
 * Resource hints for optimizing third-party resource loading.
 *
 * Adds preconnect and dns-prefetch hints to the document head
 * for critical third-party domains (Stripe, GTM, S3).
 *
 * These hints allow the browser to establish connections early,
 * reducing latency when the resources are actually needed.
 *
 * @see https://web.dev/preconnect-and-dns-prefetch/
 */

/**
 * Critical third-party domains that benefit from preconnect.
 * These domains are used during the user journey (payment, analytics, images).
 */
export const PRECONNECT_DOMAINS = [
  // Stripe payment processing
  "https://js.stripe.com",
  // Stripe API
  "https://api.stripe.com",
  // Google Tag Manager (analytics)
  "https://www.googletagmanager.com",
] as const;

/**
 * Domains that benefit from DNS prefetch (lower priority than preconnect).
 * These may be used later in the session.
 */
export const DNS_PREFETCH_DOMAINS = [
  // Google Analytics (loaded via GTM)
  "https://www.google-analytics.com",
  // Google Fonts (if using external fonts)
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
] as const;

/**
 * Component that renders resource hint meta tags.
 * Should be included in the document head via Next.js metadata or layout.
 *
 * Note: In Next.js App Router, these are typically added directly
 * in the layout.tsx head section rather than as a component.
 */
export function ResourceHints() {
  return (
    <>
      {/* Preconnect to critical domains for faster resource loading */}
      {PRECONNECT_DOMAINS.map((domain) => (
        <link key={domain} rel="preconnect" href={domain} crossOrigin="anonymous" />
      ))}

      {/* DNS prefetch for secondary domains */}
      {DNS_PREFETCH_DOMAINS.map((domain) => (
        <link key={domain} rel="dns-prefetch" href={domain} />
      ))}
    </>
  );
}

/**
 * Get resource hint tags as JSX for use in Next.js head section.
 * This is useful when you need to render hints in a server component.
 */
export function getResourceHintTags() {
  return [
    ...PRECONNECT_DOMAINS.map((domain) => ({
      rel: "preconnect",
      href: domain,
      crossOrigin: "anonymous" as const,
    })),
    ...DNS_PREFETCH_DOMAINS.map((domain) => ({
      rel: "dns-prefetch",
      href: domain,
    })),
  ];
}
