import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { HeroProps } from "../types";

export function BoldHero({
  title = "Discover Amazing Products",
  subtitle = "Shop the latest trends with confidence. Quality items, unbeatable prices, and lightning-fast delivery.",
  primaryCta = { label: "Shop Now", href: "/products" },
  secondaryCta = { label: "View Categories", href: "/categories" },
}: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background - full bleed */}
      <div className="from-primary via-primary/90 to-accent absolute inset-0 bg-gradient-to-br" />

      {/* Animated floating shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-64 w-64 animate-pulse rounded-full bg-white/10 blur-3xl" />
        <div
          className="bg-accent/30 absolute top-1/2 -right-32 h-96 w-96 animate-pulse rounded-full blur-3xl"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute -bottom-20 left-1/3 h-72 w-72 animate-pulse rounded-full bg-white/5 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 right-10 text-white/20">
        <Sparkles className="h-16 w-16 animate-bounce" style={{ animationDuration: "3s" }} />
      </div>
      <div className="absolute bottom-20 left-10 text-white/10">
        <Sparkles
          className="h-24 w-24 animate-bounce"
          style={{ animationDuration: "4s", animationDelay: "1s" }}
        />
      </div>

      {/* Content */}
      <div className="relative container py-24 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            <span>New Collection Available</span>
          </div>

          {/* Title - Bold, large, tight tracking */}
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">{subtitle}</p>

          {/* CTAs with prominent styling */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href={primaryCta.href}>
              <Button
                size="lg"
                className="text-primary w-full bg-white px-8 py-6 text-lg font-bold shadow-2xl shadow-black/20 transition-all hover:scale-105 hover:bg-white/90 sm:w-auto"
              >
                {primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-2 border-white/30 bg-white/10 px-8 py-6 text-lg font-bold text-white backdrop-blur-sm hover:bg-white/20 sm:w-auto"
              >
                {secondaryCta.label}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute right-0 bottom-0 left-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
}
