import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <Skeleton className="aspect-[4/3]" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
