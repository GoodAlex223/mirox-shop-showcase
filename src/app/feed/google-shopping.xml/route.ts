import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/seo";
import { validateFeedItemSafe, type GoogleShoppingItem } from "@/lib/validations/google-shopping";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

/**
 * Escape XML special characters in text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a Prisma Decimal value as a Google Shopping price string.
 * Google Shopping requires format: "29.99 UAH". Distinct from the shared
 * display formatter (@/lib/format) — this is the machine feed format, kept
 * as its own function (renamed from `formatPrice`) to prevent import confusion.
 */
function formatFeedPrice(price: { toString(): string }): string {
  return `${Number(price).toFixed(2)} UAH`;
}

/**
 * Resolve a ProductImage.url into the absolute URL the feed schema demands.
 *
 * `image_link` is validated with `z.string().url()`, which rejects a
 * root-relative path outright — and because the route filters on
 * `validateFeedItemSafe`, a rejected item is dropped from the feed silently.
 * The seeded catalog stores relative paths for images served out of `public/`
 * (R2-backed uploads already store absolute URLs), so before this resolution
 * existed every seeded product failed validation and the feed rendered zero
 * items. Found in the G16 Task 11 pair session; the route's own tests had used
 * an absolute-URL fixture and so never exercised the real shape.
 */
function toAbsoluteImageUrl(url: string | undefined, baseUrl: string): string {
  const fallback = new URL("/og-image.png", baseUrl).toString();
  if (!url) return fallback;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return fallback;
  }
}

/**
 * Wrap a value in an XML tag. Returns empty string if value is undefined/null/empty.
 */
function xmlTag(tag: string, value: string | undefined): string {
  if (!value) return "";
  return `      <g:${tag}>${escapeXml(value)}</g:${tag}>`;
}

/**
 * Transform a database product into a Google Shopping feed item.
 */
function transformProduct(
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortDesc: string | null;
    price: { toString(): string };
    comparePrice: { toString(): string } | null;
    sku: string;
    barcode: string | null;
    brand: string | null;
    mpn: string | null;
    stock: number;
    category: { name: string } | null;
    images: { url: string }[];
  },
  baseUrl: string
): GoogleShoppingItem {
  const item: GoogleShoppingItem = {
    id: product.id,
    title: product.name.slice(0, 150),
    description: (product.description || product.shortDesc || product.name).slice(0, 5000),
    link: `${baseUrl}/products/${product.slug}`,
    image_link: toAbsoluteImageUrl(product.images[0]?.url, baseUrl),
    price: formatFeedPrice(product.price),
    availability: product.stock > 0 ? "in stock" : "out of stock",
    condition: "new",
  };

  // Optional: sale_price (only if comparePrice exists and is higher than price)
  if (product.comparePrice && Number(product.comparePrice) > Number(product.price)) {
    item.sale_price = formatFeedPrice(product.price);
    item.price = formatFeedPrice(product.comparePrice);
  }

  // Optional product identifiers
  if (product.barcode) item.gtin = product.barcode;
  if (product.mpn) item.mpn = product.mpn;
  if (product.brand) item.brand = product.brand;

  // Category as product_type
  if (product.category) item.product_type = product.category.name;

  return item;
}

/**
 * Serialize a single feed item to XML.
 */
function itemToXml(item: GoogleShoppingItem): string {
  const lines = [
    "    <item>",
    `      <g:id>${escapeXml(item.id)}</g:id>`,
    `      <g:title>${escapeXml(item.title)}</g:title>`,
    `      <g:description>${escapeXml(item.description)}</g:description>`,
    `      <g:link>${escapeXml(item.link)}</g:link>`,
    `      <g:image_link>${escapeXml(item.image_link)}</g:image_link>`,
    `      <g:price>${escapeXml(item.price)}</g:price>`,
    xmlTag("sale_price", item.sale_price),
    `      <g:availability>${escapeXml(item.availability)}</g:availability>`,
    `      <g:condition>${escapeXml(item.condition)}</g:condition>`,
    xmlTag("gtin", item.gtin),
    xmlTag("mpn", item.mpn),
    xmlTag("brand", item.brand),
    xmlTag("product_type", item.product_type),
    "    </item>",
  ];

  return lines.filter(Boolean).join("\n");
}

/**
 * GET /feed/google-shopping.xml
 * Generates an RSS 2.0 XML feed with Google Shopping namespace for all active products
 * not flagged `excludeFromFeed`.
 */
export async function GET(): Promise<Response> {
  try {
    const products = await prisma.product.findMany({
      // G16: per-product opt-out — trademark-bearing imagery must never enter
      // the public feed, regardless of which text fields are set.
      where: { isActive: true, excludeFromFeed: false },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDesc: true,
        price: true,
        comparePrice: true,
        sku: true,
        barcode: true,
        brand: true,
        mpn: true,
        stock: true,
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const baseUrl = siteConfig.url;
    const feedItems = products
      .map((p) => transformProduct(p, baseUrl))
      .filter((item) => validateFeedItemSafe(item).success);
    const itemsXml = feedItems.map(itemToXml).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(siteConfig.name)} - Google Shopping Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product feed for ${escapeXml(siteConfig.name)}</description>
${itemsXml}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Google Shopping feed generation error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title></channel></rss>',
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }
    );
  }
}
