import type { FeaturesProps } from "../types";

export function LuxuryFeatures({ features, title = "The Experience" }: FeaturesProps) {
  return (
    <section className="border-border/50 border-y py-24 md:py-32 lg:py-40">
      <div className="container">
        {/* Header - centered, elegant */}
        <div className="mb-20 text-center">
          <div className="mb-6 inline-flex items-center gap-4">
            <span className="bg-primary/40 h-px w-12" />
            <span className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              Our Promise
            </span>
            <span className="bg-primary/40 h-px w-12" />
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h2>
        </div>

        {/* Features - horizontal layout with generous spacing */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="group text-center">
                {/* Icon - thin line style */}
                <div className="border-primary/30 group-hover:border-primary/60 group-hover:bg-primary/5 mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-500">
                  <Icon className="text-primary/70 group-hover:text-primary h-7 w-7 stroke-[1.5] transition-colors duration-500" />
                </div>

                {/* Title - serif with letter spacing */}
                <h3 className="text-foreground font-serif text-lg tracking-wide">
                  {feature.title}
                </h3>

                {/* Decorative line */}
                <div className="bg-primary/30 mx-auto mt-4 h-px w-8" />

                {/* Description */}
                <p className="text-muted-foreground mx-auto mt-4 max-w-[200px] text-sm leading-relaxed">
                  {feature.description}
                </p>

                {/* Index number - subtle */}
                <p className="text-muted-foreground/40 mt-6 text-xs">
                  {String(index + 1).padStart(2, "0")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
