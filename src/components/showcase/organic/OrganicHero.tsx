import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf } from "lucide-react";
import type { HeroProps } from "../types";

export function OrganicHero({
  title = "Naturally Beautiful",
  subtitle = "Discover products crafted with care. Sustainable choices, artisanal quality, and timeless design for mindful living.",
  primaryCta = { label: "Explore Products", href: "/products" },
  secondaryCta = { label: "Our Values", href: "/categories" },
}: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Warm gradient background */}
      <div className="from-background via-secondary/30 to-accent/10 absolute inset-0 bg-gradient-to-br" />

      {/* Organic blob shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="bg-primary/10 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-accent/15 absolute top-1/2 -left-48 h-80 w-80 rounded-full blur-3xl" />
        <div className="bg-primary/5 absolute right-1/4 -bottom-24 h-64 w-64 rounded-full blur-3xl" />
      </div>

      {/* Decorative leaves */}
      <div className="text-primary/10 absolute top-20 right-20">
        <Leaf className="h-32 w-32 rotate-12" />
      </div>
      <div className="text-accent/10 absolute bottom-32 left-16">
        <Leaf className="h-24 w-24 -rotate-45" />
      </div>

      <div className="relative container py-20 md:py-28 lg:py-36">
        <div className="mx-auto max-w-4xl text-center">
          {/* Organic badge */}
          <div className="bg-primary/10 text-primary mb-8 inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-sm font-medium">
            <Leaf className="h-4 w-4" />
            <span>Sustainably Sourced</span>
          </div>

          {/* Title - Lora serif, warm */}
          <h1 className="text-foreground font-serif text-4xl leading-[1.15] font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {title}
          </h1>

          {/* Decorative elements */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className="bg-primary/40 h-1.5 w-1.5 rounded-full" />
            <span className="bg-primary/30 h-1 w-16 rounded-full" />
            <span className="bg-primary/40 h-1.5 w-1.5 rounded-full" />
          </div>

          {/* Subtitle */}
          <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-lg leading-relaxed">
            {subtitle}
          </p>

          {/* CTAs - soft, rounded */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href={primaryCta.href}>
              <Button
                size="lg"
                className="shadow-primary/20 hover:shadow-primary/30 w-full rounded-full px-10 py-6 font-medium shadow-lg transition-all duration-300 hover:shadow-xl sm:w-auto"
              >
                {primaryCta.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button
                variant="outline"
                size="lg"
                className="hover:bg-secondary/50 w-full rounded-full border-2 px-10 py-6 font-medium sm:w-auto"
              >
                {secondaryCta.label}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Soft curved divider */}
      <div className="absolute right-0 bottom-0 left-0">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 80L48 74.7C96 69.3 192 58.7 288 53.3C384 48 480 48 576 53.3C672 58.7 768 69.3 864 69.3C960 69.3 1056 58.7 1152 53.3C1248 48 1344 48 1392 48L1440 48V80H1392C1344 80 1248 80 1152 80C1056 80 960 80 864 80C768 80 672 80 576 80C480 80 384 80 288 80C192 80 96 80 48 80H0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
}
