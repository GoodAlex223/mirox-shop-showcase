"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({ value, onChange, size = "md", className }: StarRatingProps) {
  const readonly = !onChange;

  return (
    <div className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "focus:outline-none",
            readonly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"
          )}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              sizeMap[size],
              star <= value ? "fill-rating text-rating" : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}
