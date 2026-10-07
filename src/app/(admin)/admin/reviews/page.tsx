"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star, Eye, EyeOff, Trash2, MessageSquare, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  adminReply: string | null;
  adminRepliedAt: string | null;
  createdAt: string;
  product: { id: string; name: string; slug: string };
  user: { id: string; name: string | null; email: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function ReviewsContent() {
  const t = useTranslations("admin.reviews");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [ratingFilter, setRatingFilter] = useState(searchParams?.get("rating") || "all");
  const [visibilityFilter, setVisibilityFilter] = useState(searchParams?.get("isHidden") || "all");
  const debouncedSearch = useDebounce(search, 300);

  // Dialog state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (visibilityFilter !== "all") params.set("isHidden", visibilityFilter);

      const response = await fetch(`/api/admin/reviews?${params}`);
      if (!response.ok) throw new Error("Failed to fetch reviews");

      const data = await response.json();
      setReviews(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, debouncedSearch, ratingFilter, visibilityFilter, t]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/admin/reviews?${params}`);
  };

  const handleToggleVisibility = async (review: Review) => {
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !review.isHidden }),
      });

      if (!response.ok) throw new Error("Failed to update visibility");

      toast.success(review.isHidden ? t("nowVisible") : t("nowHidden"));
      fetchReviews();
    } catch {
      toast.error(t("visibilityError"));
    }
  };

  const handleOpenReplyDialog = (review: Review) => {
    setReplyReview(review);
    setReplyText(review.adminReply || "");
    setReplyDialogOpen(true);
  };

  const handleSubmitReply = async () => {
    if (!replyReview) return;

    setIsReplying(true);
    try {
      const response = await fetch(`/api/admin/reviews/${replyReview.id}/reply`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: replyText }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("replyError"));
      }

      toast.success(t("replySuccess"));
      setReplyDialogOpen(false);
      setReplyReview(null);
      setReplyText("");
      fetchReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("replyError"));
    } finally {
      setIsReplying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/reviews/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete review");

      toast.success(t("deleteSuccess"));
      setDeleteId(null);
      fetchReviews();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t("ratingFilter.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("ratingFilter.all")}</SelectItem>
            <SelectItem value="5">{t("ratingFilter.five")}</SelectItem>
            <SelectItem value="4">{t("ratingFilter.four")}</SelectItem>
            <SelectItem value="3">{t("ratingFilter.three")}</SelectItem>
            <SelectItem value="2">{t("ratingFilter.two")}</SelectItem>
            <SelectItem value="1">{t("ratingFilter.one")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t("visibilityFilter.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("visibilityFilter.all")}</SelectItem>
            <SelectItem value="false">{t("visibilityFilter.visible")}</SelectItem>
            <SelectItem value="true">{t("visibilityFilter.hidden")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.product")}</TableHead>
              <TableHead>{t("headers.customer")}</TableHead>
              <TableHead>{t("headers.rating")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("headers.comment")}</TableHead>
              <TableHead>{t("headers.status")}</TableHead>
              <TableHead>{t("headers.date")}</TableHead>
              <TableHead className="w-[80px]">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <MessageSquare className="text-muted-foreground mx-auto h-8 w-8" />
                  <p className="text-muted-foreground mt-2">{t("empty")}</p>
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <Link
                      href={`/products/${review.product.slug}`}
                      className="font-medium hover:underline"
                      target="_blank"
                    >
                      {review.product.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{review.user.name || t("anonymous")}</p>
                      <p className="text-muted-foreground text-xs">{review.user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{review.rating}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-xs md:table-cell">
                    <p className="truncate text-sm">{review.comment || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {review.isHidden ? (
                        <Badge variant="secondary">{t("visibilityFilter.hidden")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("visibilityFilter.visible")}</Badge>
                      )}
                      {review.adminReply && (
                        <Badge variant="default" className="text-xs">
                          {t("replied")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(review.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <span className="sr-only">{tCommon("actions")}</span>
                          <span className="text-lg">&#8943;</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenReplyDialog(review)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {review.adminReply ? t("editReply") : t("reply")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleVisibility(review)}>
                          {review.isHidden ? (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              {t("show")}
                            </>
                          ) : (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              {t("hide")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(review.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tCommon("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t("showingRange", {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              {tCommon("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              {tCommon("next")}
            </Button>
          </div>
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {replyReview?.adminReply ? t("replyDialog.editTitle") : t("replyDialog.newTitle")}
            </DialogTitle>
            <DialogDescription>{t("replyDialog.description")}</DialogDescription>
          </DialogHeader>

          {replyReview && (
            <div className="bg-muted/50 rounded-md p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">
                  {replyReview.user.name || t("anonymous")}
                </span>
                <div className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{replyReview.rating}</span>
                </div>
              </div>
              {replyReview.comment && (
                <p className="text-muted-foreground text-sm">{replyReview.comment}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="admin-reply">{t("replyDialog.label")}</Label>
              <span className="text-muted-foreground text-xs">{replyText.length}/1000</span>
            </div>
            <Textarea
              id="admin-reply"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t("replyDialog.placeholder")}
              rows={4}
              maxLength={1000}
              disabled={isReplying}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              disabled={isReplying}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSubmitReply}
              disabled={isReplying || replyText.trim().length === 0}
            >
              {isReplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReplying ? t("replyDialog.saving") : t("replyDialog.saveButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.confirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? t("deleteDialog.deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-[130px]" />
        <Skeleton className="h-10 w-[130px]" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-md" />
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<ReviewsLoadingSkeleton />}>
      <ReviewsContent />
    </Suspense>
  );
}
