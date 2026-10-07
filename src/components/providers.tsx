"use client";

import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/common/CookieConsent";

// Dynamic import with ssr: false to ensure Web Vitals only runs on the client
const WebVitalsReporter = dynamic(
  () => import("@/components/analytics/WebVitalsReporter").then((mod) => mod.WebVitalsReporter),
  { ssr: false }
);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" />
      <CookieConsent />
      {/* Web Vitals reporting to GA4 via GTM */}
      <WebVitalsReporter />
    </SessionProvider>
  );
}
