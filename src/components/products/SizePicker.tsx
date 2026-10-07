"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { recommendSize } from "@/lib/size-recommendation";

const DEFAULT_HEIGHT = 180;
const DEFAULT_WEIGHT = 75;

/**
 * "Size picker" card (Mirox Product.dc.html): height/weight inputs → a
 * recommended size via the placeholder formula in @/lib/size-recommendation.
 * Deliberately uncoupled from the buy panel — it recommends, never selects
 * (TASK-045 replaces the logic with real size charts).
 */
export function SizePicker() {
  const t = useTranslations("products");
  const [height, setHeight] = useState<string>(String(DEFAULT_HEIGHT));
  const [weight, setWeight] = useState<string>(String(DEFAULT_WEIGHT));

  const h = Number(height) || DEFAULT_HEIGHT;
  const w = Number(weight) || DEFAULT_WEIGHT;
  const recommended = recommendSize(h, w);

  const inputClasses =
    "rounded-[10px] border border-border-strong bg-background px-3.5 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-white";

  return (
    <div className="bg-card border-border rounded-[20px] border p-6 sm:p-8">
      <h2 className="text-[22px] font-extrabold">{t("sizePicker.title")}</h2>
      <p className="text-muted-foreground mt-2 mb-6 text-[13.5px] leading-normal">
        {t("sizePicker.subtitle")}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <label className="text-muted-foreground flex flex-col gap-1.5 text-[12.5px] font-semibold">
            {t("sizePicker.heightLabel")}
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="text-muted-foreground flex flex-col gap-1.5 text-[12.5px] font-semibold">
            {t("sizePicker.weightLabel")}
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={inputClasses}
            />
          </label>
        </div>
        <div className="bg-background border-border rounded-[14px] border p-5">
          <div className="text-muted-foreground text-[12.5px] font-semibold">
            {t("sizePicker.resultLabel")}
          </div>
          <div data-testid="recommended-size" className="my-1 text-[44px] font-extrabold">
            {recommended}
          </div>
          <div className="text-muted-foreground mb-1.5 text-xs font-semibold">
            {t("sizePicker.recommendationsLabel")}
          </div>
          <ul className="text-foreground/80 list-disc pl-4 text-[12.5px] leading-relaxed">
            <li>{t("sizePicker.recommendations.fit")}</li>
            <li>{t("sizePicker.recommendations.comfort")}</li>
            <li>{t("sizePicker.recommendations.idealChoice")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
