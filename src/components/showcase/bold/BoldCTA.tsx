import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { CTAProps } from "../types";

export function BoldCTA({
  title = "Ready to Start Shopping?",
  description = "Join thousands of happy customers. Create your account today and get exclusive access to deals and new arrivals.",
  primaryCta = { label: "Create Account", href: "/register" },
  secondaryCta = { label: "Continue Shopping", href: "/products" },
}: CTAProps) {
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="from-primary via-primary/95 to-accent relative overflow-hidden rounded-3xl bg-gradient-to-br p-12 md:p-16 lg:p-20">
          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="bg-accent/30 absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl" />
          <div className="absolute top-8 right-8">
            <Sparkles className="h-12 w-12 animate-pulse text-white/20" />
          </div>

          {/* Content */}
          <div className="relative mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              <span>Limited Time Offer</span>
            </div>

            <h2 className="text-3xl font-extrabold text-white sm:text-4xl md:text-5xl lg:text-6xl">
              {title}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/80">{description}</p>

            {/* CTAs */}
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
      </div>
    </section>
  );
}
