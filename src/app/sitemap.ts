import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/seo";

// Force dynamic rendering - sitemap needs database access
export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cart`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/feedback`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/track`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...(
      [
        ["/contact", 0.5],
        ["/about", 0.5],
        ["/shipping", 0.3],
        ["/returns", 0.3],
        ["/faq", 0.3],
        ["/privacy", 0.3],
        ["/terms", 0.3],
      ] as const
    ).map(([path, priority]) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority,
    })),
  ];

  // Try to fetch dynamic pages, with fallback if database unavailable
  let productPages: MetadataRoute.Sitemap = [];

  try {
    // Product pages
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    productPages = products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    // Database unavailable during build, return static pages only
    console.warn("Sitemap: Database unavailable, returning static pages only", error);
  }

  return [...staticPages, ...productPages];
}
