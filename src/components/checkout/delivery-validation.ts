import { getPickupKind } from "@/lib/shipping";
import type { CheckoutInput } from "@/lib/validations";

export type DeliveryErrorKey = "city" | "branch" | "postomat" | "street";

export interface DeliveryError {
  field: "shippingAddress.city" | "shippingAddress.line1";
  /** Maps to the catalog key checkout.delivery.picker.errors.<key>. */
  key: DeliveryErrorKey;
}

/**
 * The delivery step's requirements in picker mode (spec §5.6): a city chosen
 * from the list, then a point chosen from the list — or, for courier, a typed
 * street. Text typed into a picker without choosing a row carries no ref and
 * is not an answer. Manual (fallback) mode validates through the schema instead.
 */
export function pickerModeErrors(
  values: Pick<CheckoutInput, "shippingAddress" | "shippingMethod">
): DeliveryError[] {
  const address = values.shippingAddress;
  const errors: DeliveryError[] = [];
  if (!address.npCityRef) errors.push({ field: "shippingAddress.city", key: "city" });

  const kind = getPickupKind(values.shippingMethod);
  if (kind) {
    if (!address.npWarehouseRef) errors.push({ field: "shippingAddress.line1", key: kind });
  } else if (!(address.line1 ?? "").trim()) {
    errors.push({ field: "shippingAddress.line1", key: "street" });
  }
  return errors;
}
