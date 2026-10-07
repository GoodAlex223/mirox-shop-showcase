import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "error";

/**
 * Server callers (not-found.tsx) may only pass `href` actions — functions
 * can't cross the server→client boundary. Client callers may pass either.
 */
export type StatusAction =
  | { label: string; href: string; variant?: "default" | "outline" | "destructive" }
  | { label: string; onClick: () => void; variant?: "default" | "outline" | "destructive" };

const TONE_ICON: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-foreground",
  error: "text-destructive",
};

interface StatusScreenProps {
  icon?: LucideIcon;
  iconClassName?: string;
  tone?: StatusTone;
  title: string;
  description?: string;
  /** Small line under the description, e.g. a rendered error-digest line. */
  meta?: string;
  actions?: StatusAction[];
}

/**
 * The one Mirox treatment for full-viewport status pages (404, error
 * boundaries, newsletter confirm/unsubscribe). Hook-free by design so the
 * server-rendered not-found.tsx can use it.
 */
export function StatusScreen({
  icon: Icon,
  iconClassName,
  tone = "neutral",
  title,
  description,
  meta,
  actions = [],
}: StatusScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        {Icon && (
          <Icon className={cn("mx-auto h-12 w-12", TONE_ICON[tone], iconClassName)} aria-hidden />
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
          {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {actions.map((action) =>
              "href" in action ? (
                <Button key={action.label} variant={action.variant ?? "default"} asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button
                  key={action.label}
                  variant={action.variant ?? "default"}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
