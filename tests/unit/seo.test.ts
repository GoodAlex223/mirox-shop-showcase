import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import uk from "../../messages/uk.json";

// seo.ts's now-async helpers (Task 8) read request-scoped `getTranslations`
// from next-intl/server. Vitest has no request scope (next-intl v4.13.6's
// server entry point expects the "react-server" condition, which is absent
// under vitest) — mock it with a real lookup into messages/uk.json so
// assertions verify actual catalog values instead of a hand-duplicated
// fixture that could drift. Supports namespace scoping (getTranslations("seo")
// vs getTranslations("brand")) and {param} interpolation (auth descriptions
// need {name}), which the brief's illustrative one-line mock doesn't cover.
function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" && part in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      obj
    );
}

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace?: string) => {
    const scope = namespace ? getPath(uk, namespace) : uk;
    return (key: string, params?: Record<string, string>) => {
      const raw = getPath(scope, key);
      if (typeof raw !== "string") {
        throw new Error(
          `seo.test.ts fixture: missing "${namespace ? namespace + "." : ""}${key}" in messages/uk.json`
        );
      }
      return params
        ? Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), raw)
        : raw;
    };
  },
}));

import { getTranslations } from "next-intl/server";
import {
  siteConfig,
  getDefaultMetadata,
  getProductMetadata,
  getHomeMetadata,
  getProductsListingMetadata,
  getCategoriesListingMetadata,
  getAuthMetadata,
  getOrganizationJsonLd,
  getWebsiteJsonLd,
  getProductJsonLd,
  getBreadcrumbJsonLd,
} from "@/lib/seo";

describe("SEO Utilities", () => {
  describe("siteConfig", () => {
    it("should have required properties", () => {
      expect(siteConfig).toHaveProperty("name");
      // No `description` property (Task 8): the value is now request-scoped
      // (messages/uk.json brand.description via getTranslations), not a
      // static field — see getDefaultMetadata/getHomeMetadata/getProductMetadata.
      expect(siteConfig).toHaveProperty("url");
      expect(siteConfig).toHaveProperty("ogImage");
      expect(siteConfig).toHaveProperty("locale");
    });
  });

  describe("getDefaultMetadata", () => {
    it("should return valid metadata object", async () => {
      const metadata = await getDefaultMetadata();

      expect(metadata).toHaveProperty("metadataBase");
      expect(metadata).toHaveProperty("title");
      expect(metadata).toHaveProperty("description");
      expect(metadata).toHaveProperty("openGraph");
      expect(metadata).toHaveProperty("twitter");
      expect(metadata).toHaveProperty("robots");
    });

    it("should use the catalog brand description (Task 8: was BRAND_DESCRIPTION)", async () => {
      const metadata = await getDefaultMetadata();
      expect(metadata.description).toBe(uk.brand.description);
    });

    it("should include OpenGraph configuration", async () => {
      const metadata = await getDefaultMetadata();

      expect(metadata.openGraph).toHaveProperty("type", "website");
      expect(metadata.openGraph).toHaveProperty("siteName", siteConfig.name);
      // Must NOT set openGraph.images: the root app/opengraph-image.tsx card is
      // only merged in by Next when this same-segment metadata leaves images
      // unset (mergeStaticMetadata's `!source.openGraph.hasOwnProperty('images')`
      // guard). Setting it here would suppress the generated card and pin every
      // route to the stale static PNG. Same convention as getProductMetadata.
      expect(metadata.openGraph).not.toHaveProperty("images");
    });

    it("should include Twitter card configuration without pinning an image", async () => {
      const metadata = await getDefaultMetadata();

      expect(metadata.twitter).toHaveProperty("card", "summary_large_image");
      // No real Twitter/X handle exists for the brand (site.ts socials list
      // only Instagram, TikTok, Telegram), so `creator` must stay absent
      // rather than carry a fabricated handle.
      expect(metadata.twitter).not.toHaveProperty("creator");
      // Leave twitter.images unset so postProcessMetadata auto-fills it from
      // the generated OG card rather than the stale static PNG.
      expect(metadata.twitter).not.toHaveProperty("images");
    });
  });

  describe("getProductMetadata", () => {
    const mockProduct = {
      name: "Test Product",
      slug: "test-product",
      description: "A test product description",
      shortDesc: "Short description",
      price: "29.99",
      comparePrice: "39.99",
      images: [{ url: "https://example.com/image.jpg", alt: "Product image" }],
      category: { name: "Electronics", slug: "electronics" },
    };

    it("should generate product-specific metadata", async () => {
      const metadata = await getProductMetadata(mockProduct);

      expect(metadata.title).toBe("Test Product");
      expect(metadata.description).toBe("Short description");
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.twitter).toBeDefined();
    });

    it("should not set OG images (handled by opengraph-image.tsx convention)", async () => {
      const metadata = await getProductMetadata(mockProduct);

      // OG images are generated dynamically by opengraph-image.tsx (file convention),
      // so getProductMetadata should not set images directly.
      expect(metadata.openGraph?.images).toBeUndefined();
    });

    it("should use shortDesc as description when available", async () => {
      const metadata = await getProductMetadata(mockProduct);
      expect(metadata.description).toBe("Short description");
    });

    it("should fallback to truncated description when no shortDesc", async () => {
      const productWithoutShortDesc = {
        ...mockProduct,
        shortDesc: null,
      };
      const metadata = await getProductMetadata(productWithoutShortDesc);
      expect(metadata.description).toBe("A test product description");
    });

    it("should fallback to the catalog brand description when no shortDesc or description (Task 8: was siteConfig.description)", async () => {
      const productWithoutDescriptions = {
        ...mockProduct,
        shortDesc: null,
        description: null,
      };
      const metadata = await getProductMetadata(productWithoutDescriptions);
      expect(metadata.description).toBe(uk.brand.description);
    });

    it("should not set OG images even without product images", async () => {
      const productWithoutImages = {
        ...mockProduct,
        images: undefined,
      };
      const metadata = await getProductMetadata(productWithoutImages);
      // OG images handled by opengraph-image.tsx file convention
      expect(metadata.openGraph?.images).toBeUndefined();
    });
  });

  describe("getOrganizationJsonLd", () => {
    it("should return valid Organization schema", () => {
      const jsonLd = getOrganizationJsonLd();

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("Organization");
      expect(jsonLd.name).toBe(siteConfig.name);
      expect(jsonLd.url).toBe(siteConfig.url);
    });
  });

  describe("getWebsiteJsonLd", () => {
    it("should return valid Website schema", () => {
      const jsonLd = getWebsiteJsonLd();

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("WebSite");
      expect(jsonLd.name).toBe(siteConfig.name);
    });

    it("should include SearchAction", () => {
      const jsonLd = getWebsiteJsonLd();

      expect(jsonLd.potentialAction["@type"]).toBe("SearchAction");
      expect(jsonLd.potentialAction.target.urlTemplate).toContain("search");
    });
  });

  describe("getProductJsonLd", () => {
    const mockProduct = {
      name: "Test Product",
      slug: "test-product",
      description: "A test product",
      price: "29.99",
      comparePrice: null,
      sku: "TEST-001",
      stock: 10,
      images: [{ url: "https://example.com/image.jpg" }],
      category: { name: "Electronics" },
    };

    it("should return valid Product schema", () => {
      const jsonLd = getProductJsonLd(mockProduct);

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("Product");
      expect(jsonLd.name).toBe("Test Product");
      expect(jsonLd.sku).toBe("TEST-001");
    });

    it("should include Offer with price", () => {
      const jsonLd = getProductJsonLd(mockProduct);

      expect(jsonLd.offers["@type"]).toBe("Offer");
      expect(jsonLd.offers.price).toBe("29.99");
      expect(jsonLd.offers.priceCurrency).toBe("UAH");
    });

    it("should set InStock availability when stock > 0", () => {
      const jsonLd = getProductJsonLd(mockProduct);
      expect(jsonLd.offers.availability).toBe("https://schema.org/InStock");
    });

    it("should set OutOfStock availability when stock is 0", () => {
      const outOfStockProduct = { ...mockProduct, stock: 0 };
      const jsonLd = getProductJsonLd(outOfStockProduct);
      expect(jsonLd.offers.availability).toBe("https://schema.org/OutOfStock");
    });

    it("should use empty string when description is null", () => {
      const productWithoutDesc = { ...mockProduct, description: null };
      const jsonLd = getProductJsonLd(productWithoutDesc);
      expect(jsonLd.description).toBe("");
    });

    it("should use empty array when images is undefined", () => {
      const productWithoutImages = { ...mockProduct, images: undefined };
      const jsonLd = getProductJsonLd(productWithoutImages);
      expect(jsonLd.image).toEqual([]);
    });

    it("should handle product without category", () => {
      const productWithoutCategory = { ...mockProduct, category: undefined };
      const jsonLd = getProductJsonLd(productWithoutCategory);
      expect(jsonLd.category).toBeUndefined();
    });
  });

  describe("getHomeMetadata", () => {
    it("should return absolute title with store name", async () => {
      const metadata = await getHomeMetadata();

      expect(metadata.title).toEqual({
        absolute: expect.stringContaining(siteConfig.name),
      });
    });

    it("should append the catalog meta suffix to the title (Task 8: was BRAND_META_SUFFIX)", async () => {
      const metadata = await getHomeMetadata();
      const title = (metadata.title as { absolute: string }).absolute;
      expect(title).toBe(`${siteConfig.name} — ${uk.brand.metaSuffix}`);
    });

    it("should use the catalog brand description (Task 8: was BRAND_DESCRIPTION)", async () => {
      const metadata = await getHomeMetadata();
      expect(metadata.description).toBe(uk.brand.description);
    });

    it("should include canonical URL", async () => {
      const metadata = await getHomeMetadata();
      expect(metadata.alternates?.canonical).toBe(siteConfig.url);
    });
  });

  describe("getHomeMetadata brand", () => {
    // siteConfig.name (src/lib/seo.ts) is `process.env.NEXT_PUBLIC_STORE_NAME
    // || BRAND_NAME`, read once at module load. Asserting against the
    // statically-imported getHomeMetadata above would only prove whatever
    // .env happens to set locally (it sets NEXT_PUBLIC_STORE_NAME="Store"),
    // which is exactly the environment-dependent trap
    // tests/e2e/navigation.spec.ts documents and deliberately avoids. Instead,
    // delete the var, reset the module registry, and dynamically re-import so
    // the module re-evaluates siteConfig.name with the var genuinely unset —
    // that's the only way to actually exercise the `|| BRAND_NAME` fallback
    // rather than assume it works. Env save/restore follows the repo's
    // documented convention (see tests/unit/newsletter.test.ts).
    const originalStoreName = process.env.NEXT_PUBLIC_STORE_NAME;

    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_STORE_NAME;
    });

    afterEach(() => {
      if (originalStoreName === undefined) {
        delete process.env.NEXT_PUBLIC_STORE_NAME;
      } else {
        process.env.NEXT_PUBLIC_STORE_NAME = originalStoreName;
      }
      vi.resetModules();
    });

    it("falls back to the Mirox brand name when NEXT_PUBLIC_STORE_NAME is unset, never the generic 'Store'", async () => {
      vi.resetModules();
      const freshSeo = await import("@/lib/seo");
      const metadata = await freshSeo.getHomeMetadata();
      const title = (metadata.title as { absolute: string }).absolute;
      expect(title).toContain("Mirox Shop");
      expect(title).not.toContain("Store |");
    });
  });

  describe("getProductsListingMetadata", () => {
    it("should return the catalog title (Task 8: was 'All Products')", async () => {
      const metadata = await getProductsListingMetadata();
      expect(metadata.title).toBe(uk.seo.productsListing.title);
    });

    it("should use the catalog description", async () => {
      const metadata = await getProductsListingMetadata();
      expect(metadata.description).toBe(uk.seo.productsListing.description);
    });

    it("should include canonical URL with /products path", async () => {
      const metadata = await getProductsListingMetadata();
      expect(metadata.alternates?.canonical).toBe(`${siteConfig.url}/products`);
    });

    it("should include OpenGraph data", async () => {
      const metadata = await getProductsListingMetadata();
      expect(metadata.openGraph?.url).toBe(`${siteConfig.url}/products`);
      expect(metadata.openGraph?.title).toBe(
        `${uk.seo.productsListing.title} | ${siteConfig.name}`
      );
      expect(metadata.openGraph?.description).toBe(uk.seo.productsListing.ogDescription);
    });
  });

  describe("getCategoriesListingMetadata", () => {
    it("should return the catalog title (Task 8: was 'Shop by Category')", async () => {
      const metadata = await getCategoriesListingMetadata();
      expect(metadata.title).toBe(uk.seo.categoriesListing.title);
    });

    it("should use the catalog description", async () => {
      const metadata = await getCategoriesListingMetadata();
      expect(metadata.description).toBe(uk.seo.categoriesListing.description);
    });

    it("should include canonical URL with /categories path", async () => {
      const metadata = await getCategoriesListingMetadata();
      expect(metadata.alternates?.canonical).toBe(`${siteConfig.url}/categories`);
    });

    it("should include OpenGraph data (Task 8: was the independently-EN 'Categories')", async () => {
      const metadata = await getCategoriesListingMetadata();
      expect(metadata.openGraph?.title).toBe(
        `${uk.seo.categoriesListing.ogTitle} | ${siteConfig.name}`
      );
      expect(metadata.openGraph?.description).toBe(uk.seo.categoriesListing.ogDescription);
    });
  });

  describe("getAuthMetadata", () => {
    it("should return the catalog title for login (Task 8: was 'Sign In')", async () => {
      const metadata = await getAuthMetadata("login");
      expect(metadata.title).toBe(uk.seo.auth.login.title);
    });

    it("should return the catalog title for register (Task 8: was 'Create Account')", async () => {
      const metadata = await getAuthMetadata("register");
      expect(metadata.title).toBe(uk.seo.auth.register.title);
    });

    it("should disable indexing for auth pages", async () => {
      const metadata = await getAuthMetadata("login");
      expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it("should include description mentioning store name", async () => {
      const metadata = await getAuthMetadata("login");
      expect(metadata.description).toContain(siteConfig.name);
    });

    it("should interpolate {name} into the catalog description template", async () => {
      const metadata = await getAuthMetadata("register");
      expect(metadata.description).toBe(
        uk.seo.auth.register.description.replace("{name}", siteConfig.name)
      );
      // Guards against a silently-broken mock/interpolation leaving the raw
      // ICU placeholder in production copy.
      expect(metadata.description).not.toContain("{name}");
    });
  });

  describe("getProductJsonLd with review data", () => {
    const mockProduct = {
      name: "Test Product",
      slug: "test-product",
      description: "A test product",
      price: "29.99",
      sku: "TEST-001",
      stock: 10,
      images: [{ url: "https://example.com/image.jpg" }],
      category: { name: "Electronics" },
    };
    const mockReviews = [
      {
        rating: 5,
        comment: "Excellent product!",
        authorName: "Jane Doe",
        createdAt: "2025-06-15T10:00:00.000Z",
      },
      {
        rating: 4,
        comment: null,
        authorName: "John Smith",
        createdAt: "2025-06-14T08:00:00.000Z",
      },
    ];

    it("omits review data when reviewCount is 0", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: [],
        averageRating: 0,
        reviewCount: 0,
      });
      expect(result).not.toHaveProperty("aggregateRating");
      expect(result).not.toHaveProperty("review");
    });

    it("omits review data when reviewCount is undefined", () => {
      const result = getProductJsonLd(mockProduct);
      expect(result).not.toHaveProperty("aggregateRating");
      expect(result).not.toHaveProperty("review");
    });

    it("includes aggregateRating when reviews exist", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: mockReviews,
        averageRating: 4.5,
        reviewCount: 2,
      });

      expect(result.aggregateRating).toBeDefined();
      expect(result.aggregateRating["@type"]).toBe("AggregateRating");
      expect(result.aggregateRating.ratingValue).toBe("4.5");
      expect(result.aggregateRating.reviewCount).toBe(2);
      expect(result.aggregateRating.bestRating).toBe(5);
      expect(result.aggregateRating.worstRating).toBe(1);
    });

    it("includes individual reviews with ratings and authors", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: mockReviews,
        averageRating: 4.5,
        reviewCount: 2,
      });

      expect(result.review).toHaveLength(2);
      expect(result.review[0]["@type"]).toBe("Review");
      expect(result.review[0].reviewRating.ratingValue).toBe(5);
      expect(result.review[0].author.name).toBe("Jane Doe");
      expect(result.review[0].reviewBody).toBe("Excellent product!");
      expect(result.review[0].datePublished).toBe("2025-06-15");
    });

    it("omits reviewBody when comment is null", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: mockReviews,
        averageRating: 4.5,
        reviewCount: 2,
      });

      expect(result.review[1]).not.toHaveProperty("reviewBody");
    });

    it("limits to 10 reviews maximum", () => {
      const manyReviews = Array.from({ length: 15 }, (_, i) => ({
        rating: 5,
        comment: `Review ${i}`,
        authorName: `User ${i}`,
        createdAt: "2025-06-15T10:00:00.000Z",
      }));

      const result = getProductJsonLd({
        ...mockProduct,
        reviews: manyReviews,
        averageRating: 5,
        reviewCount: 15,
      });
      expect(result.review).toHaveLength(10);
    });

    it("formats averageRating to one decimal place", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: mockReviews,
        averageRating: 4.333333,
        reviewCount: 2,
      });
      expect(result.aggregateRating.ratingValue).toBe("4.3");
    });

    it("includes both offer and review data in single Product schema", () => {
      const result = getProductJsonLd({
        ...mockProduct,
        reviews: mockReviews,
        averageRating: 4.5,
        reviewCount: 2,
      });

      // Single Product schema with all data
      expect(result["@type"]).toBe("Product");
      expect(result.offers).toBeDefined();
      expect(result.aggregateRating).toBeDefined();
      expect(result.review).toBeDefined();
    });
  });

  describe("getBreadcrumbJsonLd", () => {
    const items = [
      { name: "Home", url: "https://example.com" },
      { name: "Products", url: "https://example.com/products" },
      { name: "Test Product", url: "https://example.com/products/test" },
    ];

    it("should return valid BreadcrumbList schema", () => {
      const jsonLd = getBreadcrumbJsonLd(items);

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("BreadcrumbList");
      expect(jsonLd.itemListElement).toHaveLength(3);
    });

    it("should have correct positions for items", () => {
      const jsonLd = getBreadcrumbJsonLd(items);

      expect(jsonLd.itemListElement[0].position).toBe(1);
      expect(jsonLd.itemListElement[1].position).toBe(2);
      expect(jsonLd.itemListElement[2].position).toBe(3);
    });

    it("should include ListItem type for each item", () => {
      const jsonLd = getBreadcrumbJsonLd(items);

      jsonLd.itemListElement.forEach((item: { "@type": string }) => {
        expect(item["@type"]).toBe("ListItem");
      });
    });
  });

  describe("seo.productNotFound (fix round 1, post-Task-8 review)", () => {
    // Unlike the other seo.* keys above, this one isn't read by any seo.ts
    // export — src/app/(shop)/products/[slug]/page.tsx's generateMetadata
    // calls getTranslations("seo") directly for its not-found branch (the
    // same pattern categories/[slug]/page.tsx used for "categoryNotFound",
    // which this task originally missed one file over — that page and its
    // key are gone since G12, this one is the surviving instance).
    // This pins the catalog value through the exact same mock the rest of
    // this file uses, since there's no seo.ts helper to exercise it through.
    it("resolves to the catalog value via getTranslations('seo')", async () => {
      const t = await getTranslations("seo");
      expect(t("productNotFound")).toBe(uk.seo.productNotFound);
    });
  });
});
