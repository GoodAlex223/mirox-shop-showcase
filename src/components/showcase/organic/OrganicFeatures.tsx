import { Leaf } from "lucide-react";
import type { FeaturesProps } from "../types";

export function OrganicFeatures({ features, title = "Why Choose Us" }: FeaturesProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <Leaf className="text-primary h-5 w-5" />
            <span className="text-muted-foreground text-sm font-medium">Our Promise</span>
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
            We believe in quality, sustainability, and making your shopping experience delightful.
          </p>
        </div>

        {/* Features - organic asymmetric layout */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            // Alternate between slightly different styles for organic feel
            const isOdd = index % 2 === 1;

            return (
              <div
                key={feature.title}
                className={`group relative rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                  isOdd ? "bg-secondary/50 lg:mt-8" : "bg-card shadow-sm"
                }`}
              >
                {/* Icon - outlined style */}
                <div className="bg-primary/10 group-hover:bg-primary/20 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-105">
                  <Icon className="text-primary h-7 w-7 stroke-[1.5]" />
                </div>

                {/* Title */}
                <h3 className="text-foreground mb-2 font-serif text-lg">{feature.title}</h3>

                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative leaf - appears on hover */}
                <div className="absolute right-4 bottom-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <Leaf className="text-primary/20 h-5 w-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
