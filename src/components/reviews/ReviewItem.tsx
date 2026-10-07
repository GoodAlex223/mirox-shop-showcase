"use client";

import { useTranslations } from "next-intl";
import { StarRating } from "./StarRating";
import { Store } from "lucide-react";
import type { ReviewWithUser } from "@/types";

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("uk-UA", { timeZone: "UTC" }).format(new Date(dateString));
}

/**
 * Review card per Mirox Product.dc.html: dark elevated card, initial-circle
 * avatar, name + a verified-purchase badge (true by construction — eligibility
 * requires a DELIVERED order containing the product), stars, dd.MM.yyyy date.
 */
export function ReviewItem({ review }: { review: ReviewWithUser }) {
  const t = useTranslations("reviews");
  const displayName = review.user.name || t("item.anonymousFallback");
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-card border-border rounded-2xl border p-5 sm:p-7">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold">
          {initial}
        </span>
        <div className="min-w-0">
          {/* flex-wrap lets the badge drop to its own line on narrow screens
              instead of being ellipsis-clipped with the name (390px gate fix) */}
          <div className="flex flex-wrap items-baseline gap-x-1.5 text-[14.5px] font-bold">
            <span className="max-w-full truncate">{displayName}</span>
            <span className="text-available text-[11px] font-bold whitespace-nowrap">
              {t("item.verifiedBadge")}
            </span>
          </div>
          <StarRating value={review.rating} size="sm" />
        </div>
        <span className="ml-auto shrink-0 text-[12.5px] text-[#737373]">
          {formatDate(review.createdAt)}
        </span>
      </div>

      {review.comment && (
        <p className="text-foreground/80 text-[14.5px] leading-relaxed whitespace-pre-wrap">
          {review.comment}
        </p>
      )}

      {review.adminReply && (
        <div className="bg-background border-border mt-3.5 rounded-xl border p-3.5">
          <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <Store className="h-3 w-3" />
            {t("item.storeReply")}
            {review.adminRepliedAt && (
              <span className="font-normal"> &middot; {formatDate(review.adminRepliedAt)}</span>
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.adminReply}</p>
        </div>
      )}
    </div>
  );
}
