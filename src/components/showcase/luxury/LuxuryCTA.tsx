import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { CTAProps } from "../types";

export function LuxuryCTA({
  title = "Join Our Circle",
  description = "Create an account to receive exclusive access to new arrivals, private sales, and personalized recommendations curated just for you.",
  primaryCta = { label: "Create Account", href: "/register" },
  secondaryCta = { label: "Continue Browsing", href: "/products" },
}: CTAProps) {
  return (
    <section className="py-24 md:py-32 lg:py-40">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {/* Decorative element */}
          <div className="mb-8 inline-flex items-center gap-4">
            <span className="bg-primary/40 h-px w-16" />
            <div className="border-primary/30 flex h-8 w-8 items-center justify-center rounded-full border">
              <div className="bg-primary/60 h-2 w-2 rounded-full" />
            </div>
            <span className="bg-primary/40 h-px w-16" />
          </div>

          {/* Title - serif, elegant */}
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h2>

          {/* Decorative line */}
          <div className="bg-primary/30 mx-auto mt-8 h-px w-24" />

          {/* Description */}
          <p className="text-muted-foreground mx-auto mt-8 max-w-xl text-lg leading-relaxed">
            {description}
          </p>

          {/* CTAs - refined styling */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href={primaryCta.href}>
              <Button
                size="lg"
                className="w-full px-12 py-6 font-medium tracking-wide transition-all duration-500 hover:shadow-md sm:w-auto"
              >
                {primaryCta.label}
                <ArrowRight className="ml-3 h-4 w-4" />
              </Button>
            </Link>
            <Link href={secondaryCta.href}>
              <Button
                variant="ghost"
                size="lg"
                className="text-muted-foreground hover:text-foreground w-full px-12 py-6 font-medium tracking-wide hover:bg-transparent sm:w-auto"
              >
                {secondaryCta.label}
              </Button>
            </Link>
          </div>

          {/* Bottom decorative element */}
          <div className="mt-16 flex justify-center gap-2">
            <span className="bg-primary/30 h-1 w-1 rounded-full" />
            <span className="bg-primary/50 h-1 w-1 rounded-full" />
            <span className="bg-primary/30 h-1 w-1 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
