import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { HeroProps } from "../types";

export function LuxuryHero({
  title = "Curated Excellence",
  subtitle = "Discover our handpicked collection of premium products. Refined quality, timeless elegance, delivered with care.",
  primaryCta = { label: "Explore Collection", href: "/products" },
  secondaryCta = { label: "Our Story", href: "/categories" },
}: HeroProps) {
  return (
    <section className="bg-background relative overflow-hidden">
      {/* Subtle decorative border */}
      <div className="via-primary/30 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent" />

      <div className="container py-24 md:py-32 lg:py-40">
        {/* Asymmetric layout - 40/60 split */}
        <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-8">
          {/* Left content - 5 columns */}
          <div className="text-center lg:col-span-5 lg:text-left">
            {/* Elegant badge */}
            <div className="mb-8 inline-flex items-center gap-3">
              <span className="bg-primary/60 h-px w-8" />
              <span className="text-primary text-xs font-medium tracking-[0.3em] uppercase">
                New Arrivals
              </span>
              <span className="bg-primary/60 h-px w-8" />
            </div>

            {/* Title - Serif, elegant */}
            <h1 className="text-foreground font-serif text-4xl leading-[1.1] font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {title}
            </h1>

            {/* Decorative line */}
            <div className="bg-primary/40 mx-auto mt-8 h-px w-24 lg:mx-0" />

            {/* Subtitle - refined */}
            <p className="text-muted-foreground mx-auto mt-8 max-w-md text-lg leading-relaxed lg:mx-0">
              {subtitle}
            </p>

            {/* CTAs - understated elegance */}
            <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link href={primaryCta.href}>
                <Button
                  size="lg"
                  className="w-full px-10 py-6 font-medium tracking-wide transition-all duration-500 hover:shadow-lg sm:w-auto"
                >
                  {primaryCta.label}
                  <ArrowRight className="ml-3 h-4 w-4" />
                </Button>
              </Link>
              <Link href={secondaryCta.href}>
                <Button
                  variant="ghost"
                  size="lg"
                  className="hover:text-primary w-full px-10 py-6 font-medium tracking-wide hover:bg-transparent sm:w-auto"
                >
                  {secondaryCta.label}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right visual - 7 columns */}
          <div className="lg:col-span-7">
            <div className="relative">
              {/* Main image container with gold border */}
              <div className="border-primary/20 relative aspect-[4/3] overflow-hidden rounded-sm border">
                {/* Placeholder gradient - would be replaced with actual hero image */}
                <div className="from-muted via-muted/80 to-muted/60 absolute inset-0 bg-gradient-to-br" />

                {/* Decorative overlay pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 20px,
                      currentColor 20px,
                      currentColor 21px
                    )`,
                    }}
                  />
                </div>

                {/* Content overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="border-primary/30 inline-flex h-24 w-24 items-center justify-center rounded-full border">
                      <span className="text-primary/60 font-serif text-2xl">L</span>
                    </div>
                    <p className="text-muted-foreground mt-4 text-sm tracking-[0.2em] uppercase">
                      Premium Collection
                    </p>
                  </div>
                </div>
              </div>

              {/* Decorative corner accents */}
              <div className="border-primary/30 absolute -top-3 -left-3 h-12 w-12 border-t border-l" />
              <div className="border-primary/30 absolute -right-3 -bottom-3 h-12 w-12 border-r border-b" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <div className="via-border absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent" />
    </section>
  );
}
