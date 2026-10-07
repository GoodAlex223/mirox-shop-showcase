import type { FeaturesProps } from "../types";

export function BoldFeatures({ features, title = "Why Shop With Us" }: FeaturesProps) {
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        {/* Header */}
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
            We&apos;re committed to providing the best shopping experience
          </p>
        </div>

        {/* Features grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group bg-card relative rounded-2xl p-8 text-center shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Decorative background */}
                <div className="from-primary/5 to-accent/5 absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100" />

                {/* Icon with solid background */}
                <div className="bg-primary shadow-primary/30 relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110">
                  <Icon className="text-primary-foreground h-10 w-10" />
                </div>

                {/* Content */}
                <h3 className="text-foreground relative mb-3 text-xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground relative">{feature.description}</p>

                {/* Animated underline */}
                <div className="from-primary to-accent mx-auto mt-4 h-1 w-0 rounded-full bg-gradient-to-r transition-all duration-300 group-hover:w-16" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
