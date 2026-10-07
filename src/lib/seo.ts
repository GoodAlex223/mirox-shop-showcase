import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME, DEVELOPER_CREDIT_HREF } from "@/content/brand";

// Base site configuration
//
// No `description` field here (Task 8): the value is now locale-dependent
// (messages/uk.json `brand.description`, translated per-request), so it
// can't live on a plain module-level object the way BRAND_DESCRIPTION used
// to. The three helpers below that need it (getDefaultMetadata,
// getHomeMetadata, getProductMetadata's last-resort fallback) each fetch it
// directly via `getTranslations("brand")` instead.
export const siteConfig = {
  // Env var still wins so deployments can override, but the fallback is the
  // real brand rather than the generic "Store" placeholder. Setting
  // NEXT_PUBLIC_STORE_NAME in production remains BACKLOG'd.
  name: process.env.NEXT_PUBLIC_STORE_NAME || BRAND_NAME,
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og-image.png",
  // No real Twitter/X account exists for the brand (the site-wide socials
  // list carries Instagram, TikTok, and Telegram only). Absent data renders
  // nothing rather than a fabricated handle, so there is no twitterHandle
  // field and no `creator` line in the twitter metadata block below.
  locale: "en_US",
};

// Default metadata configuration. Async (Task 8): `description` now comes
// from the request-scoped i18n catalog (messages/uk.json `brand.description`)
// instead of a static import, and the root layout awaits this inside
// generateMetadata().
export async function getDefaultMetadata(): Promise<Metadata> {
  const t = await getTranslations("brand");
  const description = t("description");
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description,
    keywords: ["online store", "e-commerce", "shopping", "deals", "products", "fast shipping"],
    // Second entry, not a replacement: the store stays the primary author,
    // the developer is credited alongside it (DEVELOPER_CREDIT_HREF in
    // src/content/brand.ts).
    authors: [{ name: siteConfig.name }, { name: "GoodAlex223", url: DEVELOPER_CREDIT_HREF }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    // Deliberately no `images` here. Next merges a segment's opengraph-image
    // file only when that segment's metadata export does NOT already set
    // openGraph.images (resolve-metadata.ts `mergeStaticMetadata`, guarded by
    // `!source.openGraph.hasOwnProperty('images')`). This object lives on the
    // root app/ segment — the same segment as app/opengraph-image.tsx — so
    // setting images here silently suppressed the generated card and pinned
    // every route to the stale public/og-image.png (the old "Store" PNG the
    // rebrand was meant to retire). Omitting it lets the file convention win
    // site-wide, inherited by any route without its own opengraph-image.
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: siteConfig.name,
      description,
    },
    // No `images` here either: postProcessMetadata auto-fills twitter.images
    // from the resolved openGraph.images (the generated card) whenever twitter
    // has no images of its own, so the X card matches the OG card.
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon-16x16.png",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.json",
    alternates: {
      canonical: siteConfig.url,
      languages: {
        en: siteConfig.url,
        "x-default": siteConfig.url,
      },
    },
  };
}

// Generate product metadata. Async (Task 8): the last-resort description
// fallback (no metaDesc/shortDesc/description on the product at all) now
// reads the i18n catalog's brand.description instead of siteConfig.description.
export async function getProductMetadata(product: {
  name: string;
  slug: string;
  description?: string | null;
  shortDesc?: string | null;
  metaTitle?: string | null;
  metaDesc?: string | null;
  price: string;
  comparePrice?: string | null;
  category?: { name: string; slug: string };
}): Promise<Metadata> {
  const t = await getTranslations("brand");
  const title = product.metaTitle || product.name;
  const description =
    product.metaDesc || product.shortDesc || product.description?.slice(0, 160) || t("description");
  const url = `${siteConfig.url}/products/${product.slug}`;

  // Note: OG images are generated dynamically by opengraph-image.tsx (file convention).
  // Next.js automatically wires the generated image into og:image and twitter:image meta tags.
  return {
    title,
    description,
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: siteConfig.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

// Generate home page metadata. Async (Task 8): both strings now come from
// the i18n catalog (brand.description, brand.metaSuffix) instead of the
// removed BRAND_DESCRIPTION/local BRAND_META_SUFFIX import.
export async function getHomeMetadata(): Promise<Metadata> {
  const t = await getTranslations("brand");
  return {
    title: {
      absolute: `${siteConfig.name} — ${t("metaSuffix")}`,
    },
    description: t("description"),
    alternates: {
      canonical: siteConfig.url,
    },
  };
}

// Generate products listing page metadata. Async (Task 8): title/description
// strings are newly-authored UA translations in the "seo" catalog namespace
// (previously hardcoded English — see BACKLOG 2026-08-09 "SEO/metadata layer
// still English").
export async function getProductsListingMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  const url = `${siteConfig.url}/products`;
  const title = t("productsListing.title");
  return {
    title,
    description: t("productsListing.description"),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description: t("productsListing.ogDescription"),
      url,
    },
  };
}

// Generate categories listing page metadata. Async (Task 8), same reason as
// getProductsListingMetadata above. NOTE: the pre-existing English source had
// two different phrasings for the page title ("Shop by Category") and the
// OG title ("Categories") — translated independently below (ogTitle is its
// own catalog key), and both happen to read most naturally as the same UA
// word «Категорії» (matching the header nav / categories-page H1 convention
// per the task brief's guidance), which incidentally makes title and ogTitle
// consistent with each other for the first time.
export async function getCategoriesListingMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  const url = `${siteConfig.url}/categories`;
  return {
    title: t("categoriesListing.title"),
    description: t("categoriesListing.description"),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${t("categoriesListing.ogTitle")} | ${siteConfig.name}`,
      description: t("categoriesListing.ogDescription"),
      url,
    },
  };
}

// Generate auth page metadata (login/register). Async (Task 8); static
// literal keys (not a template-literal `auth.${type}.title`) so the typed
// next-intl message schema (global.d.ts) checks each branch independently.
export async function getAuthMetadata(type: "login" | "register"): Promise<Metadata> {
  const t = await getTranslations("seo");
  const title = type === "login" ? t("auth.login.title") : t("auth.register.title");
  const description =
    type === "login"
      ? t("auth.login.description", { name: siteConfig.name })
      : t("auth.register.description", { name: siteConfig.name });
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

// JSON-LD for Organization
export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "English",
    },
  };
}

// JSON-LD for WebSite (with SearchAction)
export function getWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// JSON-LD for Product (with optional review data)
export function getProductJsonLd(product: {
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  comparePrice?: string | null;
  sku: string;
  stock: number;
  images?: { url: string; alt?: string | null }[];
  category?: { name: string };
  reviews?: { rating: number; comment: string | null; authorName: string; createdAt: string }[];
  averageRating?: number;
  reviewCount?: number;
}) {
  const availability =
    product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const hasReviews =
    product.reviewCount && product.reviewCount > 0 && product.averageRating != null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || "",
    sku: product.sku,
    image: product.images?.map((img) => img.url) || [],
    category: product.category?.name,
    url: `${siteConfig.url}/products/${product.slug}`,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "UAH",
      availability,
      url: `${siteConfig.url}/products/${product.slug}`,
      seller: {
        "@type": "Organization",
        name: siteConfig.name,
      },
    },
    ...(hasReviews && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: (product.averageRating ?? 0).toFixed(1),
        reviewCount: product.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
      review: (product.reviews || []).slice(0, 10).map((r) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: {
          "@type": "Person",
          name: r.authorName,
        },
        ...(r.comment && { reviewBody: r.comment }),
        datePublished: new Date(r.createdAt).toISOString().split("T")[0],
      })),
    }),
  };
}

// JSON-LD for BreadcrumbList
export function getBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Serialize a JSON-LD object for embedding in an inline `<script>` element.
 *
 * `JSON.stringify` escapes neither `<` nor `/`, so any user-controlled string
 * reaching a JSON-LD block can close the script element and have the rest of
 * its content parsed as HTML. Product JSON-LD embeds customer review bodies and
 * reviewer display names, which made that a stored-XSS sink (G17 finding F2).
 *
 * `<`, `>` and `&` become `\uXXXX` escapes — still valid JSON, so the structured
 * data parses identically for consumers, but inert as markup. U+2028 and U+2029
 * are escaped too: they are valid in JSON strings but terminate a line in a
 * script body, which breaks parsing of the block.
 *
 * Always use this instead of `JSON.stringify` for `dangerouslySetInnerHTML`;
 * `tests/unit/json-ld-escaping.test.ts` fails the build if a call site does not.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
