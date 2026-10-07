import Link from "next/link";
import { useTranslations } from "next-intl";
// Imported directly rather than via the reviews barrel: the barrel also pulls
// in ReviewForm/ReviewList/ReviewSection and their dependencies, which a unit
// test rendering this component would otherwise have to load.
import { StarRating } from "@/components/reviews/StarRating";
import { FadeIn } from "@/components/common/FadeIn";
import type { Testimonial } from "@/lib/review-queries";

interface TestimonialsProps {
  testimonials: Testimonial[];
}

/** Real reviews only. Omitted entirely when none qualify — a new store's state. */
export function Testimonials({ testimonials }: TestimonialsProps) {
  const t = useTranslations("home");
  if (testimonials.length === 0) return null;

  return (
    <section className="border-border container border-t py-16 lg:py-[72px]">
      <FadeIn>
        <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-[32px]">
          {t("testimonials.title")}
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-card border-border hover-lift rounded-2xl border p-7"
              data-testid="testimonial-card"
            >
              <div className="mb-3.5 flex items-center gap-3">
                <span className="bg-secondary flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold">
                  {testimonial.authorName.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-bold">{testimonial.authorName}</div>
                  <StarRating value={testimonial.rating} size="sm" />
                </div>
                <span className="text-faint ml-auto text-[12.5px]">
                  {new Date(testimonial.createdAt).toLocaleDateString("uk-UA")}
                </span>
              </div>
              <p className="text-foreground/85 text-sm leading-relaxed">{testimonial.comment}</p>
              {/* Documented deviation from the mockup: ties the real review to
                  its product. */}
              <Link
                href={`/products/${testimonial.productSlug}`}
                className="text-faint hover:text-foreground mt-3 block text-xs transition-colors"
              >
                {testimonial.productName}
              </Link>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
