import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Locally defined, NOT imported from @/content/site's (now icon-only)
// BenefitItem: this component still renders title/description, but those
// strings live in the i18n catalog since TASK-039 G9 — callers (Footer.tsx,
// the homepage) zip site.ts/home.ts's icon-only config with translated text
// before passing props here, so this component itself stays i18n-agnostic.
interface BenefitStripItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface BenefitStripProps {
  items: BenefitStripItem[];
  className?: string;
}

/**
 * Horizontal benefit row. Content arrives as a prop because the hero and the
 * footer show different items (delivery/exchange/quality/support vs
 * delivery/returns/payment/support) with identical structure.
 */
export function BenefitStrip({ items, className }: BenefitStripProps) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("bg-border grid grid-cols-2 gap-px lg:grid-cols-4", className)}>
      {items.map(({ icon: Icon, title, description }) => (
        <li
          key={title}
          className="bg-background flex items-center gap-4 px-5 py-5 lg:px-10 lg:py-7"
        >
          <Icon className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
