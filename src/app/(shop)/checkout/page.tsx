"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, ShoppingBag, Lock } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCartStore } from "@/stores/cart.store";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations";
import { DELIVERY_METHODS, DEFAULT_DELIVERY_METHOD_ID } from "@/lib/shipping";
import { formatPrice } from "@/lib/format";
import { checkout } from "@/content/checkout";
import {
  CheckoutContactLinks,
  NpDeliveryFields,
  clearPickupPoint,
  pickerModeErrors,
} from "@/components/checkout";
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo } from "@/lib/analytics";

type CheckoutStep = "information" | "shipping" | "payment";

const inputClass = "border-border-strong bg-background rounded-[10px] border px-3.5 py-3 text-sm";

// Hydration gate without a setState-in-effect (react-hooks/set-state-in-effect,
// PR #29 r5): false during SSR + the hydration render, true right after —
// same behavior as the old mounted flag, none of the cascading-render lint.
const emptySubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tShipping = useTranslations("shipping");
  const router = useRouter();
  const { data: session } = useSession();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const mounted = useHydrated();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("information");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Spec §5.7: one failed directory call puts the delivery step in manual mode
  // for the rest of the visit. Lives here, not in NpDeliveryFields, because
  // step 2 unmounts while the customer is on step 3.
  const [npUnavailable, setNpUnavailable] = useState(false);

  // Step nav labels: the internal step ids ("information"/"shipping") predate
  // this migration and don't literally match their catalog keys
  // ("contacts"/"delivery") — preserved as-is, just computed per-render now
  // that labels come from t() instead of a module-level content import.
  const STEPS: Array<{ id: CheckoutStep; label: string }> = [
    { id: "information", label: t("steps.contacts") },
    { id: "shipping", label: t("steps.delivery") },
    { id: "payment", label: t("steps.payment") },
  ];

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: session?.user?.email || "",
      shippingAddress: {
        name: session?.user?.name || "",
        company: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "UA",
        phone: "",
      },
      shippingMethod: DEFAULT_DELIVERY_METHOD_ID,
      customerNotes: "",
    },
  });

  useEffect(() => {
    if (session?.user?.email) {
      form.setValue("email", session.user.email);
    }
    if (session?.user?.name) {
      form.setValue("shippingAddress.name", session.user.name);
    }
  }, [session, form]);

  const handleNpUnavailable = useCallback(() => {
    setNpUnavailable(true);
    // Refs picked against a directory we can no longer reach are dropped; only the
    // CHOSEN city and point text (the form values) stay for the customer to correct.
    // Text merely typed into a picker's draft lives in the picker's own state and is
    // lost when the plain inputs mount.
    form.setValue("shippingAddress.npCityRef", undefined);
    form.setValue("shippingAddress.npWarehouseRef", undefined);
    form.setValue("shippingAddress.state", "");
    // The picker's messages must not follow the customer into the free-text fields.
    form.clearErrors(["shippingAddress.city", "shippingAddress.line1"]);
  }, [form]);

  // GA4: Track begin checkout (once)
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !checkoutTracked.current) {
      checkoutTracked.current = true;
      trackBeginCheckout(
        items.map((item) => ({
          item_id: item.productId,
          item_name: item.name,
          item_variant: item.size,
          price: item.price,
          quantity: item.quantity,
        })),
        getTotalPrice()
      );
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = getTotalPrice();
  // useWatch, not form.watch — the React Compiler lint rule flags watch() as
  // an unmemoizable API (surfaced by the r5 handler restructure).
  const shippingMethodId = useWatch({ control: form.control, name: "shippingMethod" });
  const line1Value = useWatch({ control: form.control, name: "shippingAddress.line1" });
  // A manual error is not re-validated on typing (the step is an onClick), so
  // once a street is typed its "required" error is dropped here. Blank keeps it.
  useEffect(() => {
    if ((line1Value ?? "").trim() && form.getFieldState("shippingAddress.line1").error) {
      form.clearErrors("shippingAddress.line1");
    }
  }, [line1Value, form]);
  const selectedShipping = DELIVERY_METHODS.find((m) => m.id === shippingMethodId);
  const shippingCost = selectedShipping?.price || 0;
  const total = subtotal + shippingCost;

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleContinueToShipping = async () => {
    const isValid = await form.trigger(["email", "shippingAddress.name", "shippingAddress.phone"]);
    if (isValid) {
      setCurrentStep("shipping");
    }
  };

  const handleContinueToPayment = async () => {
    if (npUnavailable) {
      const isValid = await form.trigger([
        "shippingAddress.city",
        "shippingAddress.line1",
        "shippingMethod",
      ]);
      if (!isValid) return;
    } else {
      // Picker mode (spec §5.6): a city or point typed but not chosen from the
      // list carries no ref, so it is not an answer. Clear first: this handler
      // is an onClick, not handleSubmit, so RHF never re-validates and a
      // passing run would otherwise leave an earlier manual error behind.
      form.clearErrors(["shippingAddress.city", "shippingAddress.line1"]);
      const deliveryErrors = pickerModeErrors(form.getValues());
      for (const { field, key } of deliveryErrors) {
        form.setError(field, { type: "manual", message: t(`delivery.picker.errors.${key}`) });
      }
      if (deliveryErrors.length > 0) return;
    }

    const gaItems = items.map((item) => ({
      item_id: item.productId,
      item_name: item.name,
      item_variant: item.size,
      price: item.price,
      quantity: item.quantity,
    }));
    trackAddShippingInfo(gaItems, getTotalPrice(), selectedShipping?.name || "");
    trackAddPaymentInfo(gaItems, getTotalPrice(), "cod");
    setCurrentStep("payment");
  };

  const handleSubmitOrder = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = form.getValues();
      const response = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.orderNumber) {
        // User-facing copy never routes through err.message — a fetch
        // TypeError would surface browser-English otherwise (PR #29 r5).
        // Server error codes → localized copy via a guarded dynamic key
        // (next-intl v4.13.6 t.has, verified available — TASK-039 Task 5);
        // unknown/absent codes fall back to errors.orderFailed.
        const code = data?.code as string | undefined;
        const key = code ? `errors.${code}` : "";
        setError(key && t.has(key as never) ? t(key as never) : t("errors.orderFailed"));
        setIsProcessing(false);
        return;
      }

      clearCart();
      router.push(`/checkout/confirmation?order=${data.orderNumber}`);
    } catch {
      setError(t("errors.orderFailed"));
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md text-center">
          <ShoppingBag className="text-muted-foreground mx-auto h-16 w-16" />
          <h1 className="mt-6 text-2xl font-extrabold">{t("empty.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("empty.description")}</p>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-[10px] bg-white px-7 py-4 text-[13.5px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
          >
            {t("empty.cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10 lg:py-12">
      <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">{t("title")}</h1>

      {/* Step nav — numbered circles per handoff */}
      <div className="mt-6 mb-8 flex items-center gap-2 text-[13px] font-bold">
        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            aria-label={t("steps.cart")}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-transparent text-[11.5px]">
              <ShoppingBag className="h-3 w-3" />
            </span>
            <span className="hidden sm:inline">{t("steps.cart")}</span>
          </Link>
          <span className="text-muted-foreground mx-1">→</span>
        </div>
        {STEPS.map((step, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <div key={step.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
              <button
                type="button"
                className={`flex items-center gap-2 ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                } disabled:cursor-default`}
                onClick={() => isDone && setCurrentStep(step.id)}
                disabled={!isDone || isProcessing}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11.5px] ${
                    isActive
                      ? "border-white bg-white text-black"
                      : isDone
                        ? "border-white bg-transparent"
                        : "border-border-strong bg-transparent"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={isActive ? "" : "hidden sm:inline"}>{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div>
          <Form {...form}>
            <form className="space-y-6">
              {/* Step 1 — contacts */}
              {currentStep === "information" && (
                <div className="bg-card border-border rounded-[20px] border p-7 lg:p-8">
                  <h2 className="text-xl font-extrabold">{t("contact.heading")}</h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="shippingAddress.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("contact.name.label")}</FormLabel>
                          <FormControl>
                            <Input
                              className={inputClass}
                              placeholder={t("contact.name.placeholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingAddress.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("contact.phone.label")}</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              className={inputClass}
                              placeholder={t("contact.phone.placeholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>{t("contact.email.label")}</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className={inputClass}
                              placeholder={t("contact.email.placeholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-6 rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
                    onClick={handleContinueToShipping}
                  >
                    {t("contact.next")}
                  </button>
                </div>
              )}

              {/* Step 2 — delivery */}
              {currentStep === "shipping" && (
                <div className="bg-card border-border rounded-[20px] border p-7 lg:p-8">
                  <h2 className="text-xl font-extrabold">{t("delivery.heading")}</h2>
                  <FormField
                    control={form.control}
                    name="shippingMethod"
                    render={({ field }) => (
                      <FormItem className="mt-6">
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              // A point chosen for one method is not valid for
                              // another (spec §5.6); manual text is left alone.
                              if (value !== field.value) {
                                // The old method's picker message must not stay.
                                form.clearErrors(["shippingAddress.city", "shippingAddress.line1"]);
                                if (!npUnavailable) clearPickupPoint(form);
                              }
                              field.onChange(value);
                            }}
                            defaultValue={field.value}
                            className="flex flex-col gap-3"
                          >
                            {DELIVERY_METHODS.map((method) => (
                              <Label
                                key={method.id}
                                htmlFor={method.id}
                                className={`flex cursor-pointer items-center justify-between gap-4 rounded-[14px] border p-5 transition-colors ${
                                  field.value === method.id
                                    ? "border-white"
                                    : "border-border-strong hover:border-muted-foreground"
                                }`}
                              >
                                <span className="flex items-center gap-3.5">
                                  <RadioGroupItem value={method.id} id={method.id} />
                                  <span>
                                    <span className="block text-[14.5px] font-bold">
                                      {tShipping(method.id as never)}
                                    </span>
                                    <span className="text-muted-foreground mt-0.5 block text-[12.5px]">
                                      {method.description}
                                    </span>
                                  </span>
                                </span>
                                <span className="text-sm font-extrabold whitespace-nowrap">
                                  {formatPrice(method.price)}
                                </span>
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="mt-5 grid gap-4">
                    <NpDeliveryFields
                      form={form}
                      methodId={shippingMethodId}
                      unavailable={npUnavailable}
                      onUnavailable={handleNpUnavailable}
                      inputClass={inputClass}
                    />
                    <FormField
                      control={form.control}
                      name="customerNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("delivery.notes.label")}</FormLabel>
                          <FormControl>
                            <Textarea
                              className={`${inputClass} resize-none`}
                              placeholder={t("delivery.notes.placeholder")}
                              maxLength={500}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="border-border-strong hover:border-muted-foreground rounded-[10px] border px-6 py-4 text-[13px] font-bold transition-colors"
                      onClick={() => setCurrentStep("information")}
                    >
                      {t("delivery.back")}
                    </button>
                    <button
                      type="button"
                      className="rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
                      onClick={handleContinueToPayment}
                    >
                      {t("delivery.next")}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — payment (no payment processing — COD, spec §2) */}
              {currentStep === "payment" && (
                <div className="bg-card border-border rounded-[20px] border p-7 lg:p-8">
                  <h2 className="text-xl font-extrabold">{t("payment.heading")}</h2>

                  <div className="border-border mt-6 rounded-[14px] border border-white p-5">
                    <p className="text-[14.5px] font-bold">{t("payment.cod.name")}</p>
                    <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                      {t("payment.cod.description")}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-3 text-sm font-semibold">
                    {t("payment.noPrepay")}
                  </p>

                  {/* Content-gated prepay block (spec §2): card details when the
                      client supplies them, contact-the-manager fallback until then. */}
                  <div className="bg-muted/40 border-border mt-5 rounded-[14px] border p-5 text-sm">
                    {checkout.payment.prepay.cardNumber ? (
                      <>
                        <p className="font-semibold">{t("payment.prepay.cardLabel")}</p>
                        <p className="mt-1 text-base font-extrabold tracking-wider">
                          {checkout.payment.prepay.cardNumber}
                        </p>
                        {checkout.payment.prepay.cardHolder && (
                          <p className="text-muted-foreground mt-0.5">
                            {checkout.payment.prepay.cardHolder}
                          </p>
                        )}
                        <p className="text-muted-foreground mt-3">
                          {t("payment.prepay.contactLabel")}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">{t("payment.prepay.offer")}</p>
                    )}
                    <CheckoutContactLinks contacts={checkout.contacts} />
                  </div>

                  {error && (
                    <div className="bg-destructive/10 text-destructive mt-5 rounded-lg p-4 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="border-border-strong hover:border-muted-foreground rounded-[10px] border px-6 py-4 text-[13px] font-bold transition-colors disabled:opacity-50"
                      onClick={() => setCurrentStep("shipping")}
                      disabled={isProcessing}
                    >
                      {t("payment.back")}
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleSubmitOrder}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("payment.submitting")}
                        </span>
                      ) : (
                        `${t("payment.submit")} — ${formatPrice(total)}`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="bg-card border-border rounded-[20px] border p-7">
            <h2 className="text-lg font-extrabold">{t("summary.heading")}</h2>
            <div className="mt-5 flex max-h-64 flex-col gap-3.5 overflow-y-auto">
              {items.map((item) => {
                const variantLine = [
                  item.color,
                  item.size,
                  t("summary.qty", { count: item.quantity }),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={`${item.productId}-${item.variantId || ""}`}
                    className="flex items-center gap-3.5"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={56}
                        height={64}
                        className="h-16 w-14 shrink-0 rounded-[10px] object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-16 w-14 shrink-0 items-center justify-center rounded-[10px]">
                        <ShoppingBag className="text-muted-foreground h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{item.name}</p>
                      <p className="text-muted-foreground text-xs">{variantLine}</p>
                    </div>
                    <p className="text-[13.5px] font-extrabold whitespace-nowrap">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="border-border mt-5 flex flex-col gap-2.5 border-t pt-4 text-[13.5px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("summary.itemsLabel")}</span>
                <span className="font-bold whitespace-nowrap">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("summary.shippingLabel")}</span>
                <span className="font-bold whitespace-nowrap">{formatPrice(shippingCost)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-base">
                <span className="font-bold">{t("summary.totalLabel")}</span>
                <span className="font-extrabold whitespace-nowrap">{formatPrice(total)}</span>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 flex items-center justify-center gap-2 text-xs font-semibold">
              <Lock className="h-3.5 w-3.5" />
              {t("secureNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
