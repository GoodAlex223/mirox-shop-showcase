"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ConsentStatus = "pending" | "accepted" | "declined";

interface ConsentStore {
  status: ConsentStatus;
  accept: () => void;
  decline: () => void;
}

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set) => ({
      status: "pending" as ConsentStatus,
      accept: () => set({ status: "accepted" }),
      decline: () => set({ status: "declined" }),
    }),
    { name: "cookie-consent" }
  )
);

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{1,10}$/;

export function CookieConsent() {
  const t = useTranslations("system.cookies");
  const { status, accept, decline } = useConsentStore();
  const [mounted, setMounted] = useState(false);
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const isValidGtmId = gtmId && GTM_ID_PATTERN.test(gtmId);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Load GTM when consent is accepted */}
      {status === "accepted" && isValidGtmId && (
        <>
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}

      {/* Consent banner */}
      {status === "pending" && (
        <div className="bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-muted-foreground text-sm">{t("message")}</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={decline}>
                {t("decline")}
              </Button>
              <Button size="sm" onClick={accept}>
                {t("accept")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
