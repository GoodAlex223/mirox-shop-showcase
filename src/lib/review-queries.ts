import { prisma } from "@/lib/db";

/**
 * Serialized review for homepage display. Dates are strings because this
 * crosses into client components — the "Serialized" convention documented in
 * src/types/index.ts.
 */
export interface Testimonial {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  productName: string;
  productSlug: string;
  createdAt: string;
}

/**
 * Real customer reviews for the homepage testimonials rail. Unlike the trust
 * numbers in site.claims, this is backed by genuine data, so it ships.
 *
 * Prisma's `comment: { not: null }` cannot exclude whitespace-only strings, so
 * those are filtered after the query.
 */
export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  const reviews = await prisma.review.findMany({
    where: {
      isHidden: false,
      rating: { gte: 4 },
      comment: { not: null },
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return reviews
    .filter((review) => review.comment !== null && review.comment.trim().length > 0)
    .map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment as string,
      authorName: review.user.name ?? "Verified customer",
      productName: review.product.name,
      productSlug: review.product.slug,
      createdAt: review.createdAt.toISOString(),
    }));
}
