import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Zap, Crown, Leaf } from "lucide-react";

const themes = [
  {
    id: "bold",
    name: "Bold & Vibrant",
    description:
      "Energetic, modern design with electric blue and coral accents. High contrast, prominent shadows, and dynamic animations.",
    icon: Zap,
    href: "/showcase/bold",
    gradient: "from-blue-500 to-rose-500",
    features: [
      "Full-bleed hero",
      "4-column product grid",
      "Horizontal scroll categories",
      "Bounce animations",
    ],
  },
  {
    id: "luxury",
    name: "Luxury Premium",
    description:
      "Sophisticated, elegant design with gold accents and serif typography. Generous whitespace and refined interactions.",
    icon: Crown,
    href: "/showcase/luxury",
    gradient: "from-amber-600 to-yellow-500",
    features: [
      "Asymmetric hero layout",
      "3-column with borders",
      "Vertical category list",
      "Fade animations",
    ],
  },
  {
    id: "organic",
    name: "Organic Scandinavian",
    description:
      "Natural, calming design with sage green and terracotta. Soft rounded corners and earth-tone palette.",
    icon: Leaf,
    href: "/showcase/organic",
    gradient: "from-emerald-600 to-amber-600",
    features: [
      "Warm rounded hero",
      "Soft shadow cards",
      "Pill-shaped categories",
      "Gentle float animations",
    ],
  },
];

export default function ShowcaseIndexPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Theme Showcase
            </h1>
            <p className="text-muted-foreground mt-6 text-lg">
              Explore three distinct visual designs demonstrating how the same e-commerce
              functionality can be presented with completely different aesthetics. Each theme is a
              complete, extractable template.
            </p>
          </div>
        </div>
      </section>

      {/* Theme Cards */}
      <section className="container pb-16">
        <div className="grid gap-8 md:grid-cols-3">
          {themes.map((theme) => {
            const Icon = theme.icon;
            return (
              <Card key={theme.id} className="group relative overflow-hidden">
                {/* Gradient header */}
                <div className={`h-32 bg-gradient-to-br ${theme.gradient}`}>
                  <div className="flex h-full items-center justify-center">
                    <Icon className="h-12 w-12 text-white/90" />
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-xl">{theme.name}</CardTitle>
                  <CardDescription>{theme.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="text-muted-foreground mb-6 space-y-1 text-sm">
                    {theme.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${theme.gradient}`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link href={theme.href}>
                    <Button className="group-hover:bg-primary/90 w-full">
                      View Theme
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Info section */}
      <section className="bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">How It Works</h2>
            <p className="text-muted-foreground mt-4">
              Each theme demonstrates different approaches to layout, typography, spacing, and
              animations while sharing the same underlying data and business logic. Click any theme
              above to see a fully-designed homepage variation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
