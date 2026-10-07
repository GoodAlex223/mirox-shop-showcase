"use client";

import { useCallback } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NP_QUERY_MAX_LENGTH } from "@/lib/nova-poshta-shared";
import { getPickupKind } from "@/lib/shipping";
import type { CheckoutInput } from "@/lib/validations";
import { NpCombobox, type ComboboxOption } from "./NpCombobox";
import { fetchNpCities, fetchNpWarehouses } from "./np-directory";

type CheckoutForm = UseFormReturn<CheckoutInput>;

/**
 * Drops the chosen pickup point and its ref (spec §5.6). Called on a city
 * change and on a delivery-method switch: a branch ref surviving onto a
 * postomat order is exactly the inverted-UUID failure (decision doc §6.3).
 */
export function clearPickupPoint(form: CheckoutForm) {
  form.setValue("shippingAddress.line1", "");
  form.setValue("shippingAddress.npWarehouseRef", undefined);
}

interface NpDeliveryFieldsProps {
  form: CheckoutForm;
  methodId: string;
  /** Spec §5.7: true once any directory call failed — free-text entry for the rest of the visit. */
  unavailable: boolean;
  onUnavailable: () => void;
  inputClass: string;
}

/**
 * The delivery step's address inputs (G25). Picker mode: a city from Nova
 * Poshta's directory, then a branch or postomat of that city — or a typed
 * street for courier. Manual mode: today's two free-text fields.
 */
export function NpDeliveryFields({
  form,
  methodId,
  unavailable,
  onUnavailable,
  inputClass,
}: NpDeliveryFieldsProps) {
  const t = useTranslations("checkout.delivery");
  const kind = getPickupKind(methodId);
  const [city, npCityRef, line1, npWarehouseRef] = useWatch({
    control: form.control,
    name: [
      "shippingAddress.city",
      "shippingAddress.npCityRef",
      "shippingAddress.line1",
      "shippingAddress.npWarehouseRef",
    ],
  });

  const loadPoints = useCallback(
    (query: string, signal: AbortSignal) =>
      fetchNpWarehouses(npCityRef ?? "", kind ?? "branch", query, signal),
    [npCityRef, kind]
  );

  if (unavailable) {
    return (
      <>
        <p role="status" className="text-muted-foreground text-sm">
          {t("picker.fallbackNotice")}
        </p>
        <FormField
          control={form.control}
          name="shippingAddress.city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("city.label")}</FormLabel>
              <FormControl>
                <Input className={inputClass} placeholder={t("city.placeholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shippingAddress.line1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("address.label")}</FormLabel>
              <FormControl>
                <Input className={inputClass} placeholder={t("address.placeholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </>
    );
  }

  const texts = {
    loading: t("picker.loading"),
    empty: t("picker.empty"),
    truncated: t("picker.truncated"),
  };

  const selectCity = (option: ComboboxOption | null) => {
    form.setValue("shippingAddress.city", option?.label ?? "");
    form.setValue("shippingAddress.state", option?.description ?? "");
    form.setValue("shippingAddress.npCityRef", option?.value);
    if (kind) clearPickupPoint(form);
    if (option) form.clearErrors("shippingAddress.city");
  };

  const selectPoint = (option: ComboboxOption | null) => {
    form.setValue("shippingAddress.line1", option?.label ?? "");
    form.setValue("shippingAddress.npWarehouseRef", option?.value);
    if (option) form.clearErrors("shippingAddress.line1");
  };

  return (
    <>
      <FormField
        control={form.control}
        name="shippingAddress.city"
        render={() => (
          <FormItem>
            <FormLabel>{t("picker.city.label")}</FormLabel>
            <FormControl>
              <NpCombobox
                inputClassName={inputClass}
                placeholder={t("picker.city.placeholder")}
                selectedLabel={npCityRef ? city : ""}
                onSelectOption={selectCity}
                loadOptions={fetchNpCities}
                onLoadError={onUnavailable}
                minQueryLength={2}
                maxQueryLength={NP_QUERY_MAX_LENGTH}
                texts={texts}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {kind ? (
        <FormField
          // Remount on a new city or kind: the picker's typed draft and its
          // cached page belong to the old search.
          key={`${npCityRef ?? ""}:${kind}`}
          control={form.control}
          name="shippingAddress.line1"
          render={() => (
            <FormItem>
              <FormLabel>{t(`picker.${kind}.label`)}</FormLabel>
              <FormControl>
                <NpCombobox
                  inputClassName={inputClass}
                  disabled={!npCityRef}
                  placeholder={
                    npCityRef ? t(`picker.${kind}.placeholder`) : t("picker.chooseCityFirst")
                  }
                  selectedLabel={npWarehouseRef ? line1 : ""}
                  onSelectOption={selectPoint}
                  loadOptions={loadPoints}
                  onLoadError={onUnavailable}
                  minQueryLength={0}
                  maxQueryLength={NP_QUERY_MAX_LENGTH}
                  texts={texts}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <FormField
          control={form.control}
          name="shippingAddress.line1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("picker.street.label")}</FormLabel>
              <FormControl>
                <Input
                  className={inputClass}
                  placeholder={t("picker.street.placeholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
