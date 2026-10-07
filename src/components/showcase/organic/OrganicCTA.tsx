import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Heart } from "lucide-react";
import type { CTAProps } from "../types";

export function OrganicCTA({
  title = "Join Our Community",
  description = "Create an account to save your favorites, track orders, and receive personalized recommendations for products you'll love.",
  primaryCta = { label: "Get Started", href: "/register" },
  secondaryCta = { label: "Keep Browsing", href: "/products" },
}: CTAProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="from-primary/10 via-secondary/50 to-accent/10 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br p-10 md:p-16">
          {/* Decorative elements */}
          <div className="text-primary/10 absolute top-8 left-8">
            <Leaf className="h-24 w-24 rotate-12" />
          </div>
          <div className="text-accent/10 absolute right-8 bottom-8">
            <Leaf className="h-20 w-20 -rotate-45" />
          </div>
          <div className="text-primary/5 absolute top-1/2 right-1/4">
            <Heart className="h-32 w-32" />
          </div>

          {/* Content */}
          <div className="relative mx-auto max-w-2xl text-center">
            {/* Icon */}
            <div className="bg-primary/10 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full">
              <Heart className="text-primary h-8 w-8" />
            </div>

            {/* Title - serif */}
            <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>

            {/* Decorative dots */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="bg-primary/30 h-1.5 w-1.5 rounded-full" />
              <span className="bg-primary/20 h-1 w-8 rounded-full" />
              <span className="bg-primary/30 h-1.5 w-1.5 rounded-full" />
            </div>

            {/* Description */}
            <p className="text-muted-foreground mx-auto mt-6 max-w-lg leading-relaxed">
              {description}
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href={primaryCta.href}>
                <Button
                  size="lg"
                  className="shadow-primary/20 w-full rounded-full px-10 py-6 font-medium shadow-lg transition-all duration-300 hover:shadow-xl sm:w-auto"
                >
                  {primaryCta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={secondaryCta.href}>
                <Button
                  variant="ghost"
                  size="lg"
                  className="hover:bg-background/50 w-full rounded-full px-10 py-6 font-medium sm:w-auto"
                >
                  {secondaryCta.label}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
