"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "./StarRating";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReviewFormProps {
  productId: string;
  orderId: string;
  onReviewCreated: (review: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: { id: string; name: string | null; image: string | null };
  }) => void;
}

export function ReviewForm({ productId, orderId, onReviewCreated }: ReviewFormProps) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error(t("form.selectRatingError"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          orderId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("form.submitError"));
      }

      const review = await response.json();
      toast.success(t("form.submitSuccess"));
      onReviewCreated(review);
      setRating(0);
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("form.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border-border space-y-4 rounded-2xl border p-5"
    >
      <h3 className="font-extrabold">{t("form.heading")}</h3>

      <div className="space-y-2">
        <Label>{t("form.ratingLabel")}</Label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="review-comment">{t("form.commentLabel")}</Label>
          <span className="text-muted-foreground text-xs">{comment.length}/2000</span>
        </div>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("form.commentPlaceholder")}
          rows={4}
          maxLength={2000}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={rating === 0 || isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
