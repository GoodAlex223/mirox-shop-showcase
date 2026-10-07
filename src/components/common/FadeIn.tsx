"use client";

import { useSyncExternalStore, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay for the entrance animation, in ms. */
  delay?: number;
  /** Element/tag to render as. Defaults to "div". */
  as?: ElementType;
}

/**
 * Visible-by-default entrance. Children render at rest (`opacity-100`) so the
 * server HTML is never hidden (motion invariant I1); when motion is allowed a
 * one-shot `.animate-fade-up` plays. Reduced motion drops the animation class
 * entirely (globals.css also disables the keyframe as a belt-and-braces).
 * No IntersectionObserver — deep sections animate on load, which is why nothing
 * is ever left stuck hidden waiting on a scroll that may not happen.
 */
export function FadeIn({ children, className, delay = 0, as: Component = "div" }: FadeInProps) {
  const prefersReduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <Component
      className={cn("opacity-100", !prefersReduced && "animate-fade-up", className)}
      style={!prefersReduced && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
