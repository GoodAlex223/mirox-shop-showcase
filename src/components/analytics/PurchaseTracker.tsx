"use client";

import { useEffect, useRef } from "react";
import { trackPurchase, type GA4Item } from "@/lib/analytics";

interface PurchaseTrackerProps {
  orderNumber: string;
  total: number;
  tax: number;
  shippingCost: number;
  items: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    variantInfo?: string | null;
  }[];
}

export function PurchaseTracker({
  orderNumber,
  total,
  tax,
  shippingCost,
  items,
}: PurchaseTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const ga4Items: GA4Item[] = items.map((item) => ({
      item_id: item.productId,
      item_name: item.productName,
      item_variant: item.variantInfo || undefined,
      price: item.unitPrice,
      quantity: item.quantity,
    }));

    trackPurchase(orderNumber, total, ga4Items, shippingCost, tax);
  }, [orderNumber, total, tax, shippingCost, items]);

  return null;
}
