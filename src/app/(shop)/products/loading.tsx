import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[160px]" />
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <Skeleton className="aspect-square" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="mt-4 h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
