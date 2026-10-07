/**
 * Presentation styles for SupplierOrder.status.
 * SupplierOrder.status is a plain Prisma String (no enum) with a lowercase
 * vocabulary written by supplier.service.ts (pending/submitted/confirmed/
 * shipped/delivered/cancelled/failed). Deliberately parallel to
 * order-status.ts, which is keyed to the uppercase OrderStatus enum — do not
 * merge the two. Monochrome by policy; destructive is reserved for
 * cancelled/failed. Labels live in the messages catalog
 * (admin.supplierOrderStatus), resolved with a t.has guard because the
 * vocabulary is convention-only.
 */
export const SUPPLIER_ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  submitted: "bg-muted text-foreground",
  confirmed: "bg-secondary text-secondary-foreground",
  shipped: "bg-secondary text-secondary-foreground",
  delivered: "bg-foreground text-background",
  cancelled: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
};

export function getSupplierOrderStatusStyle(status: string): string {
  return SUPPLIER_ORDER_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
}
