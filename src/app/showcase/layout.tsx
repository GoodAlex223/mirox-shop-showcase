"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

// Hydration-safe mounting check
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

// Map route to theme class
function getThemeFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname.includes("/showcase/bold")) return "bold";
  if (pathname.includes("/showcase/luxury")) return "luxury";
  if (pathname.includes("/showcase/organic")) return "organic";
  return null;
}

const themes = [
  { id: "bold", name: "Bold", href: "/showcase/bold", color: "bg-blue-500" },
  { id: "luxury", name: "Luxury", href: "/showcase/luxury", color: "bg-amber-600" },
  { id: "organic", name: "Organic", href: "/showcase/organic", color: "bg-emerald-600" },
];

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMounted = useIsMounted();
  const currentTheme = getThemeFromPath(pathname);

  return (
    <div className={cn("flex min-h-screen flex-col", currentTheme ?? undefined)}>
      {/* Showcase Header */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Store</span>
          </Link>

          <div className="flex items-center gap-2">
            <Palette className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">
              {currentTheme
                ? `${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)} Theme`
                : "Showcase"}
            </span>
          </div>

          {isMounted && (
            <nav className="flex items-center gap-1">
              {themes.map((theme) => (
                <Link key={theme.id} href={theme.href}>
                  <Button
                    variant={currentTheme === theme.id ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <span className={`h-3 w-3 rounded-full ${theme.color}`} />
                    <span className="hidden sm:inline">{theme.name}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6">
        <div className="text-muted-foreground container text-center text-sm">
          <p>Theme Showcase &middot; Demonstrating visual design capabilities</p>
        </div>
      </footer>
    </div>
  );
}
