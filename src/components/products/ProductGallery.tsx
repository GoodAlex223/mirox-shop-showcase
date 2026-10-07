"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IMAGE_SIZES } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

interface ProductGalleryProps {
  images: { url: string; alt: string | null }[];
  productName: string;
}

/**
 * PDP gallery (Mirox Product.dc.html): ≥lg — 96px vertical thumbnail rail +
 * main photo at clamp(420px, 100vh−190px, 620px); <lg — full-width
 * scroll-snap swipe track with the reference's dots pager (active dot = 18px
 * bar). One shared activeIndex: thumb clicks drive the desktop main image,
 * scroll position drives the dots. Real swipe behavior is only verifiable in
 * a browser (visual gate) — jsdom asserts state/aria wiring.
 *
 * Sync mechanism: desktop thumb clicks update activeIndex; an effect then
 * syncs the (hidden) mobile track's scrollLeft to match. A ResizeObserver
 * handles the rotation/breakpoint transition (track gains width), ensuring
 * the dots and visible slide stay aligned when crossing lg boundary.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const t = useTranslations("products");
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // Set by scrollToSlide: this activeIndex change rides its own smooth scroll,
  // so the sync effect must not instant-snap over it (PR #27 review).
  const smoothTargetRef = useRef<number | null>(null);
  // RO delivers an initial callback on every observe(); only a real width
  // change (mount, rotation, breakpoint) may trigger a sync from that path.
  const lastTrackWidthRef = useRef(0);

  // Sync the (hidden) mobile track's scroll position with activeIndex when it becomes
  // visible, and when activeIndex changes (via thumb clicks). Also add a ResizeObserver
  // to handle rotation/breakpoint transitions.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Instant scroll sync whenever activeIndex changes and track is laid out
    const syncScroll = () => {
      if (!track || track.clientWidth === 0) return;
      const expectedScrollLeft = activeIndex * track.clientWidth;
      if (Math.round(track.scrollLeft / track.clientWidth) !== activeIndex) {
        // behavior: "instant" bypasses the track's scroll-smooth CSS; scroll-smooth defers "auto" to CSS
        track.scrollTo({ left: expectedScrollLeft, behavior: "instant" as ScrollBehavior });
      }
    };

    if (smoothTargetRef.current === activeIndex) {
      // Dot click: the smooth scroll it started is still in flight — consume
      // the flag and let it animate instead of snapping.
      smoothTargetRef.current = null;
    } else {
      syncScroll();
    }

    // ResizeObserver to handle rotation/breakpoint transitions (track gains width)
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (track.clientWidth !== lastTrackWidthRef.current) {
          lastTrackWidthRef.current = track.clientWidth;
          syncScroll();
        }
      });
      resizeObserver.observe(track);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  }, [activeIndex]);

  const hasImages = images.length > 0;
  const active = images[activeIndex] ?? images[0];

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== activeIndex && index >= 0 && index < images.length) setActiveIndex(index);
  };

  const scrollToSlide = (index: number) => {
    smoothTargetRef.current = index;
    setActiveIndex(index);
    trackRef.current?.scrollTo({
      left: index * (trackRef.current?.clientWidth ?? 0),
      behavior: "smooth",
    });
  };

  if (!hasImages) {
    return (
      <div className="border-border relative h-[400px] overflow-hidden rounded-[20px] border lg:h-[clamp(420px,calc(100vh-190px),620px)]">
        <ProductImage alt={productName} sizes={IMAGE_SIZES.productDetail} />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Mobile: swipe track + dots */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={t("gallery.photosAria", { name: productName })}
        >
          {images.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="relative h-[400px] w-full shrink-0 snap-center"
            >
              <ProductImage
                src={image.url}
                alt={image.alt || t("gallery.slideAlt", { name: productName, index: index + 1 })}
                sizes="100vw"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 py-3">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={t("gallery.goToPhoto", { index: index + 1 })}
                onClick={() => scrollToSlide(index)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  index === activeIndex ? "w-[18px] bg-white" : "w-1 bg-[#404040]"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumb rail + main image (the rail is the reference's left column;
          the parent grid in the shell places [rail | main] via grid-cols). */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[96px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              aria-label={t("gallery.photoOf", { index: index + 1, total: images.length })}
              aria-current={index === activeIndex ? "true" : "false"}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative h-24 w-24 overflow-hidden rounded-xl border transition-colors",
                index === activeIndex
                  ? "border-border-strong"
                  : "border-border hover:border-border-strong"
              )}
            >
              <ProductImage
                src={image.url}
                alt={
                  image.alt || t("gallery.thumbnailAlt", { name: productName, index: index + 1 })
                }
                sizes={IMAGE_SIZES.thumbnail}
              />
            </button>
          ))}
        </div>
        <div className="border-border relative h-[clamp(420px,calc(100vh-190px),620px)] overflow-hidden rounded-[20px] border">
          <ProductImage
            src={active?.url}
            alt={active?.alt || productName}
            sizes={IMAGE_SIZES.productDetail}
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
}
