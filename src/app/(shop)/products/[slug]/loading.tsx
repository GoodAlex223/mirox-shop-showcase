import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="container py-6 lg:py-8">
      <Skeleton className="mb-4 h-4 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="hidden gap-6 lg:grid lg:grid-cols-[96px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[clamp(420px,calc(100vh-190px),620px)] rounded-[20px]" />
        </div>
        <Skeleton className="h-[400px] rounded-[20px] lg:hidden" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2.5">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-9 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-[52px] rounded-[10px]" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </div>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
      </div>
    </div>
  );
}
