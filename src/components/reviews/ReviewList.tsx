"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ReviewItem } from "./ReviewItem";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { ReviewWithUser } from "@/types";

interface ReviewListProps {
  productSlug: string;
  initialReviews: ReviewWithUser[];
  totalReviews: number;
}

export function ReviewList({ productSlug, initialReviews, totalReviews }: ReviewListProps) {
  const t = useTranslations("reviews");
  const [reviews, setReviews] = useState<ReviewWithUser[]>(initialReviews);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialReviews.length < totalReviews);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReviews = useCallback(
    async (pageNum: number, rating: string, replace: boolean) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "10",
        });
        if (rating !== "all") params.set("rating", rating);

        const response = await fetch(`/api/products/${productSlug}/reviews?${params}`);
        if (!response.ok) return;

        const data = await response.json();
        const newReviews = data.data as ReviewWithUser[];

        if (replace) {
          setReviews(newReviews);
        } else {
          setReviews((prev) => [...prev, ...newReviews]);
        }
        setHasMore(data.pagination.hasNext);
      } finally {
        setIsLoading(false);
      }
    },
    [productSlug]
  );

  const handleFilterChange = (value: string) => {
    setRatingFilter(value);
    setPage(1);
    fetchReviews(1, value, true);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(nextPage, ratingFilter, false);
  };

  return (
    <div>
      {/* Filter */}
      {totalReviews > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium">{t("list.filterLabel")}</span>
          <Select value={ratingFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("list.filterAll")}</SelectItem>
              <SelectItem value="5">{t("list.filterFive")}</SelectItem>
              <SelectItem value="4">{t("list.filterFour")}</SelectItem>
              <SelectItem value="3">{t("list.filterThree")}</SelectItem>
              <SelectItem value="2">{t("list.filterTwo")}</SelectItem>
              <SelectItem value="1">{t("list.filterOne")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Reviews */}
      {reviews.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {ratingFilter !== "all" ? t("list.emptyFiltered") : t("list.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? t("list.loading") : t("list.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
