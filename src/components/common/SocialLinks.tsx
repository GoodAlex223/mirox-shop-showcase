import { Instagram, Send, Music2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { site, type SocialLink } from "@/content/site";

// lucide has no TikTok or Telegram brand glyph; Music2 and Send are the
// conventional stand-ins and keep the set monochrome and consistent.
const ICONS: Record<SocialLink["platform"], LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  telegram: Send,
};

/**
 * Follower counts render ONLY when a real number is configured. TODO.md's
 * acceptance criterion is explicit that counters appear only if real numbers
 * are supplied, and fabricated social proof is out of scope per TASK-051.
 *
 * Uses Intl.NumberFormat with compact notation for consistent rounding. For
 * example, 999,950 rounds to 1M, not "1000K". Deliberately still hardcodes
 * "en-US": TASK-039 scoped this out (recorded in
 * scripts/i18n-byte-diff-allow.txt) — localized compact suffixes ("тис.",
 * "млн") are future work for if/when real follower counts go live.
 */
function formatFollowers(count: number): string {
  if (count < 1_000) {
    return String(count);
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(count);
}

interface SocialLinksProps {
  className?: string;
  variant?: "inline" | "tiles";
}

export function SocialLinks({ className, variant = "inline" }: SocialLinksProps) {
  const isTiles = variant === "tiles";
  return (
    <ul
      className={cn(
        isTiles ? "flex flex-wrap justify-center gap-4" : "flex flex-wrap items-center gap-4",
        className
      )}
    >
      {site.socials.map((social) => {
        const Icon = ICONS[social.platform];
        return (
          <li key={social.platform}>
            {/*
              Content box is ~20px tall (h-5 icon / text-sm line-height), under
              WCAG 2.2 AA's 24x24 minimum target size (same class of bug Task 5
              fixed on the announcement bar's dismiss button). `py-2` grows the
              hit area to 36px; the matching `-my-2` cancels it back out of flow
              so the visible row height and the `gap-4` spacing to neighboring
              links are unchanged. Only applies to the inline variant; the
              tiles variant's larger px-8 py-6 hit area already clears 24x24.
            */}
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              // Icons-only in the footer (inline variant): the visible label
              // gives way to a native hover tooltip there. The tiles variant
              // keeps its own visible label, so no tooltip is needed on top.
              title={isTiles ? undefined : social.label}
              className={cn(
                "transition-colors",
                isTiles
                  ? "glass hover-lift flex flex-col items-center gap-2 rounded-lg px-8 py-6 text-sm"
                  : "hover:text-muted-foreground -my-2 inline-flex items-center gap-2 py-2 text-sm"
              )}
            >
              <Icon className={isTiles ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
              {/*
                Inline variant (footer): label text is `sr-only`, not removed
                — it stays in the accessibility tree (and thus in the link's
                accessible name, `getByRole("link", { name: ... })`-queryable)
                while being visually hidden behind the icon-only treatment.
                The tiles variant keeps the label fully visible.
              */}
              <span className={isTiles ? undefined : "sr-only"}>{social.label}</span>
              {social.followers !== null && (
                <span className="text-muted-foreground text-xs">
                  {formatFollowers(social.followers)}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
