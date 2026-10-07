/**
 * Root layout with optimized font loading and performance features.
 *
 * Font loading strategy:
 * - Inter (primary) and JetBrains Mono (code): Always loaded, no preload delay
 * - Playfair Display (luxury theme): Loaded with display:swap, preload:false
 * - Lora (organic theme): Loaded with display:swap, preload:false
 *
 * The theme fonts use preload:false to defer their loading until the fonts
 * are actually used, saving ~60-80KB on initial load for users on default theme.
 *
 * Performance features:
 * - Resource hints for critical third-party domains
 * - Web Vitals reporting to GA4 via GTM
 * - Deferred theme font loading
 *
 * Note: force-dynamic is required because the app uses client-side contexts
 * (auth) that don't work during static prerendering.
 */
export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display, Lora, Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import {
  getDefaultMetadata,
  getOrganizationJsonLd,
  getWebsiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import { PRECONNECT_DOMAINS, DNS_PREFETCH_DOMAINS } from "@/components/common/ResourceHints";
import { STOREFRONT_EXCLUDED_NAMESPACES } from "@/i18n/client-namespaces";
import "./globals.css";

// Primary sans-serif font (always loaded immediately)
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

// Heading + wordmark font (Mirox design system, always loaded immediately)
// cyrillic-ext is mandatory: it is the only subset carrying the hryvnia sign (U+20B4)
// Manrope is a variable font (wght 200-800); no `weight` array means next/font loads
// the full variable range instead of pinning static instances. Pinning to
// ["500","700","800"] previously left font-semibold (600) with no matching
// instance, so it silently resolved up to 700.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

// Monospace font for code snippets (always loaded immediately)
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif font for Luxury theme headings
// preload: false - only loaded when CSS actually uses the font
// display: swap - shows fallback font while loading, prevents FOIT
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// Serif font for Organic theme headings
// Same optimizations as playfair
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// Task 8: getDefaultMetadata is now async (reads the request-scoped i18n
// catalog for brand.description), so the static `metadata` export becomes
// Next's generateMetadata() convention.
export async function generateMetadata(): Promise<Metadata> {
  return getDefaultMetadata();
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Namespaces in STOREFRONT_EXCLUDED_NAMESPACES stay out of the storefront client
  // payload (G13 spec §2, G23): admin chrome has its own nested provider in the
  // (admin) layout, and the info/legal pages namespace has no client consumer
  // (Server Components only) — see src/i18n/client-namespaces.ts.
  const clientMessages = Object.fromEntries(
    Object.entries(messages).filter(
      ([namespace]) => !STOREFRONT_EXCLUDED_NAMESPACES.includes(namespace)
    )
  ) as typeof messages;
  const organizationJsonLd = getOrganizationJsonLd();
  const websiteJsonLd = getWebsiteJsonLd();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} ${lora.variable} ${manrope.variable}`}
    >
      <head>
        {/* Resource hints for faster third-party connections */}
        {PRECONNECT_DOMAINS.map((domain) => (
          <link key={domain} rel="preconnect" href={domain} crossOrigin="anonymous" />
        ))}
        {DNS_PREFETCH_DOMAINS.map((domain) => (
          <link key={domain} rel="dns-prefetch" href={domain} />
        ))}

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(websiteJsonLd),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} ${lora.variable} ${manrope.variable} antialiased`}
      >
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
