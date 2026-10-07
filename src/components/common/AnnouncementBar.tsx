"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { site } from "@/content/site";

// Dismissal is id-scoped (G8): a new announcement (new id) resurfaces for
// users who dismissed a previous one. Computed per call, not module scope —
// the content module is mocked per-test, and a module-scope key would freeze
// the first mock's id.
function dismissedKey(): string {
  return `mirox:announcement-dismissed:${site.announcement?.id ?? ""}`;
}

// `dismissed` is external mutable state: it lives in localStorage, which can
// change from the dismiss button below, from devtools, or from another tab —
// so it's read via useSyncExternalStore instead of mirrored into local state
// with `useEffect` + `setState`. (This file used to do the latter, justified
// by a comment claiming "nothing external mutates this value while the
// component is mounted" — that's false for a localStorage-backed flag, which
// is exactly why it's wired up properly here. Same idiom as FadeIn.tsx's
// `matchMedia` subscription.)
//
// `listeners` is module-scoped rather than component-scoped because
// AnnouncementBar mounts exactly once, in the shop layout
// (src/app/(shop)/layout.tsx) — there's one logical subscriber, and keeping
// the pub/sub set at module scope means `dismiss()` can notify it without a
// ref back to "the" mounted instance. A Set (not a single slot) still
// degrades correctly if that assumption ever changes — e.g. Fast Refresh's
// double-mount, or a second placement of the bar — since each mount adds and
// removes only its own listener.
const listeners = new Set<() => void>();

function subscribeDismissed(onChange: () => void) {
  listeners.add(onChange);

  // The native `storage` event fires in every OTHER tab/window when
  // localStorage changes, but never in the tab that made the write — so this
  // covers cross-tab propagation, while `dismiss()` below covers the
  // same-tab case the browser deliberately won't. It's one listener for the
  // lifetime of the one mount, so adding it costs nothing worth skipping.
  function onStorage(event: StorageEvent) {
    if (event.key === dismissedKey()) onChange();
  }
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getDismissedSnapshot(): boolean {
  return window.localStorage.getItem(dismissedKey()) === "1";
}

function getDismissedServerSnapshot(): boolean {
  // Stay hidden during SSR/first paint: reading localStorage during render
  // would desync server and client HTML and trip a hydration mismatch. The
  // real value resolves once useSyncExternalStore reconciles post-hydration,
  // which pops the bar in and nudges content down — a small accepted CLS
  // cost shared with CookieConsent/CartDrawer's post-mount reveal, inherent
  // to SSR + localStorage-gated UI. Not "fixed" with a blocking inline
  // script — this codebase deliberately moved away from that class of trick
  // when it dropped next-themes (TASK-034).
  return true;
}

function dismiss() {
  window.localStorage.setItem(dismissedKey(), "1");
  listeners.forEach((listener) => listener());
}

/**
 * Top announcement bar (brief list #2 item 13).
 *
 * Sticky WITH the header since the 2026-08-12 gate ruling: the shop layout
 * wraps this bar and the Header in one `sticky top-0 z-50` container, so the
 * launch announcement stays visible on scroll (mobile viewport cost accepted
 * by the user, superseding the TASK-035-era not-sticky decision). Cookie
 * consent is bottom-anchored, so the two never stack.
 *
 * The admin-managed version of this banner is TASK-047.
 */
export function AnnouncementBar() {
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );
  // Root translator (no namespace): this component reads two different
  // catalog subtrees (site.announcement.* and the flat site.announcementDismiss
  // sibling), so a single namespace scope doesn't fit both.
  const t = useTranslations();

  const announcement = site.announcement;
  const marqueeVisible = !dismissed && site.announcement?.marquee === true;

  const linkClass =
    "bg-foreground text-background hover:bg-foreground/80 inline-block rounded-full px-3 py-0.5 font-semibold no-underline transition-colors";
  // text/linkLabel are now fixed catalog strings (TASK-039 G9), not optional
  // config — the SiteAnnouncement type no longer has a way to express "href
  // set but no distinct label", so that third render mode (whole-text-as-
  // link, no separate pill) is no longer reachable and has been dropped.
  const text = t("site.announcement.text");
  const linkLabel = t("site.announcement.linkLabel");

  // Duplicate copies are real links so every visible pill is mouse-clickable
  // (gate ruling 8) — but tabIndex -1 + the copy's aria-hidden keep exactly
  // one tab stop and one accessible link.
  function renderCopy(isDuplicate: boolean) {
    if (!announcement) return null;
    const tabIndex = isDuplicate ? -1 : undefined;
    if (announcement.href) {
      return (
        <>
          {text}{" "}
          <Link href={announcement.href} tabIndex={tabIndex} className={linkClass}>
            {linkLabel}
          </Link>
        </>
      );
    }
    return text;
  }

  // Gate ruling 9: two copies leave a right-edge void whenever one copy is
  // narrower than the viewport. Measure and render enough copies to keep the
  // stream continuous, shifting by exactly one copy width. useEffect (not
  // useLayoutEffect): the bar never SSRs visible, and a one-frame 2-copy
  // start at the left edge is imperceptible.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const firstCopyRef = useRef<HTMLSpanElement | null>(null);
  const [copies, setCopies] = useState(2);
  const [shiftPx, setShiftPx] = useState<number | null>(null);

  useEffect(() => {
    // getDismissedServerSnapshot() always answers "dismissed" for the first
    // (hydration) commit, so the bar renders null on that pass and only
    // mounts its refs on the corrective re-render once
    // useSyncExternalStore reconciles against the real localStorage value.
    // A `[]`-deps effect fires once, right after that FIRST (null) commit —
    // it finds no refs, bails, and never runs again, so the marquee never
    // gets measured. Depending on `marqueeVisible` makes the effect re-run
    // when the bar actually mounts.
    if (!marqueeVisible) return;
    const viewport = viewportRef.current;
    const first = firstCopyRef.current;
    if (!viewport || !first) return;

    function measure() {
      if (!viewport || !first) return;
      const copyWidth = first.getBoundingClientRect().width;
      const viewWidth = viewport.getBoundingClientRect().width;
      if (!copyWidth || !viewWidth) return; // jsdom / display:none — keep the 2-copy fallback
      setCopies(Math.max(2, Math.ceil(viewWidth / copyWidth) + 1));
      setShiftPx(copyWidth);
    }

    measure();
    // jsdom has no ResizeObserver constructor (unlike every real browser) —
    // guard construction, matching ProductGallery.tsx's established pattern,
    // so unit tests get the static `measure()` call above (a no-op there,
    // since jsdom layout is always zero) without crashing on mount.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(viewport);
      // The copy is observed too, not just the viewport: a late webfont swap
      // resizes the TEXT while the viewport stays exactly as wide as it was,
      // so a viewport-only observer never fires and `--marquee-shift` keeps a
      // shift measured against the fallback font — one copy width out of step
      // with what is actually rendered, which shows up as a seam in the
      // stream. Both targets share the one observer, so the existing
      // `disconnect()` below still tears everything down.
      observer.observe(first);
    }
    return () => observer?.disconnect();
  }, [marqueeVisible]);

  if (!announcement || dismissed) return null;

  return (
    <div className="bg-background text-foreground border-border border-b">
      <div className="flex w-full items-center gap-3 py-2 pr-3">
        {announcement.marquee ? (
          <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden">
            <div
              className="animate-marquee"
              style={
                shiftPx
                  ? ({
                      "--marquee-shift": `${shiftPx}px`,
                      // Constant ~30 px/s regardless of copy width.
                      animationDuration: `${Math.round(shiftPx / 30)}s`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <span ref={firstCopyRef} className="pr-12 text-xs tracking-wide">
                {renderCopy(false)}
              </span>
              {Array.from({ length: copies - 1 }, (_, i) => (
                <span
                  key={i}
                  className="marquee-duplicate pr-12 text-xs tracking-wide"
                  aria-hidden="true"
                >
                  {renderCopy(true)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          /*
           * ⚠️ Before activating this variant, fix the inset first (G8
           * residue item 4). The row above is `pr-3` with no matching `pl-3`
           * — deliberate for the marquee, whose stream must start flush at
           * the left edge, but wrong here: `text-center` centres within a
           * box that is 3 units short on the right only, so the copy sits
           * visibly left of true centre with the dismiss button beside it.
           * The variant is unreachable today (`site.announcement.marquee` is
           * `true`), which is why this is a note rather than a change — a
           * fix now would be untestable through the UI.
           */
          <p className="flex-1 text-center text-xs tracking-wide">{renderCopy(false)}</p>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("site.announcementDismiss")}
          className="text-muted-foreground hover:text-foreground -m-2 p-2 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
