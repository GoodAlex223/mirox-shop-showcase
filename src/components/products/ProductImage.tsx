"use client";

import { useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/common/Logo";
import { DEFAULT_BLUR_DATA_URL } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string;
  alt: string;
  sizes: string;
  className?: string;
}

/**
 * Product image with a branded fallback. A missing src, or a src that 404s at
 * runtime (onError), renders the Mirox mark on --muted instead of a blank box —
 * making the data-level broken images (dead seed URLs, tracked in BACKLOG) look
 * deliberate. Client component so it can catch the load error (ProductCard is
 * itself "use client" since the TASK-036 carousel, but this component's own
 * error state still has to live here, closest to the <Image>).
 */
export function ProductImage({ src, alt, sizes, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        data-testid="product-image-fallback"
        className={cn(
          "bg-muted text-muted-foreground/40 flex h-full items-center justify-center",
          className
        )}
        aria-hidden="true"
      >
        <Logo showText={false} size="lg" className="scale-[2.5] opacity-70" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn(
        "object-cover transition-transform duration-300 group-hover:scale-105",
        className
      )}
      sizes={sizes}
      placeholder="blur"
      blurDataURL={DEFAULT_BLUR_DATA_URL}
      onError={() => setFailed(true)}
    />
  );
}
