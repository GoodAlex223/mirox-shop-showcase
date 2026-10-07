"use client";

/**
 * Client component for reporting Web Vitals to GA4.
 *
 * Uses the web-vitals library directly to capture Core Web Vitals
 * and reports them to GTM dataLayer for GA4 tracking.
 *
 * This component renders nothing - it only runs the reporting side effect.
 * Uses useEffect to ensure it only runs on the client after hydration.
 */

import { useEffect } from "react";
import { reportWebVitalsToGA4 } from "@/lib/web-vitals";

export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamic import to ensure this only runs on the client
    import("web-vitals").then(({ onCLS, onLCP, onFCP, onTTFB, onINP }) => {
      const reportMetric = (metric: { name: string; value: number; rating: string }) => {
        reportWebVitalsToGA4(metric);

        // Log to console in development for debugging
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[Web Vitals] ${metric.name}: ${Math.round(metric.value)} (${metric.rating})`
          );
        }
      };

      // Register all Core Web Vitals handlers
      // Note: FID was removed in web-vitals v4, replaced by INP
      onCLS(reportMetric);
      onLCP(reportMetric);
      onFCP(reportMetric);
      onTTFB(reportMetric);
      onINP(reportMetric);
    });
  }, []);

  // This component renders nothing
  return null;
}
