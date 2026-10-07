"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VARIANT_NAMES } from "@/lib/variant-names";
import { COLOR_SWATCH_CLASSES } from "@/lib/product-display";

type VariantName = (typeof VARIANT_NAMES)[keyof typeof VARIANT_NAMES];
const NAME_OPTIONS: VariantName[] = [VARIANT_NAMES.size, VARIANT_NAMES.color];
const COLOR_DATALIST_ID = "admin-product-variant-color-options";

interface VariantRow {
  id: string;
  name: string;
  value: string;
  stock: number;
}

interface ProductVariantsSectionProps {
  productId: string;
}

/**
 * G16: name → value → stock rows over /api/admin/products/[id]/variants.
 * The name control is a Select over VARIANT_NAMES — never free text — so a
 * hand-typed "Size" (which breaks every storefront lookup) is unenterable.
 * Value/stock edits persist on blur via PATCH; per-variant price/sku are
 * deliberately not exposed (YAGNI).
 */
export function ProductVariantsSection({ productId }: ProductVariantsSectionProps) {
  const t = useTranslations("admin.productVariants");
  const tCommon = useTranslations("admin.common");
  const base = `/api/admin/products/${productId}/variants`;

  const [rows, setRows] = useState<VariantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: VariantName; value: string; stock: string }>({
    name: VARIANT_NAMES.size,
    value: "",
    stock: "0",
  });

  // I2/G16 fix: server-confirmed values, keyed by row id — updated on load
  // and on every successful add/patch, never on a keystroke. The blur
  // handlers below fall back to this instead of the (possibly drifted)
  // optimistic `rows` state, so an empty/invalid edit reverts to what the
  // server actually holds rather than to whatever the last keystroke wrote.
  const committedRef = useRef<Record<string, { name: string; value: string; stock: number }>>({});

  // I6/G16 fix: the initial-fetch effect below must not depend on `t`.
  // useTranslations' return is memoised today so there's no loop right now,
  // but that's exactly the shape of the G13 use-toast loop bug — if the
  // provider's messages identity ever churns, this effect would refetch in
  // a loop. The ref gives the catch branch a current translator without the
  // effect depending on its identity.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // I2/G16 fix: shared by the initial load and by patchVariant's failure
  // branch below (a refetch is the simplest correct rollback for a rejected
  // optimistic edit — see patchVariant).
  const refetchRows = useCallback(async () => {
    const res = await fetch(base);
    if (!res.ok) throw new Error();
    const data: VariantRow[] = await res.json();
    setRows(data);
    committedRef.current = Object.fromEntries(
      data.map((r) => [r.id, { name: r.name, value: r.value, stock: r.stock }])
    );
    return data;
  }, [base]);

  useEffect(() => {
    const initialLoad = async () => {
      try {
        await refetchRows();
      } catch {
        toast.error(tRef.current("toasts.loadError"));
      } finally {
        setIsLoading(false);
      }
    };
    initialLoad();
  }, [refetchRows]);

  // The API returns English `error` prose (log/consumer text) plus a machine
  // `code` (see src/lib/api-utils.ts's apiError). This admin panel is
  // UA-catalog-driven since G13, so we never render `data.error` — we map
  // `code` through byCode instead, falling back to a generic UA sentence for
  // an absent/unknown code. Same guarded-dynamic-key pattern as
  // feedback-form.tsx / NewsletterSignup.tsx.
  const errorMessageForCode = useCallback(
    (code?: string) => {
      const key = code ? `byCode.${code}` : "";
      return key && t.has(key as never) ? t(key as never) : t("fallback");
    },
    [t]
  );

  // I4/G16 fix: a Колір variant with no COLOR_SWATCH_CLASSES entry saves
  // fine but silently degrades on the storefront — ProductCard filters the
  // value out of the swatch row entirely, filter-bar renders a blank chip.
  // The <datalist> below offers the known keys as suggestions, but that's
  // guidance, not a control — this warning after every successful save is
  // the actual control, so a typo ("Темно синій" for "Темно-синій") doesn't
  // disappear without a trace.
  const warnIfNoSwatch = useCallback(
    (row: Pick<VariantRow, "name" | "value">) => {
      if (row.name === VARIANT_NAMES.color && !(row.value in COLOR_SWATCH_CLASSES)) {
        toast.warning(t("toasts.noSwatch", { value: row.value }));
      }
    },
    [t]
  );

  const addVariant = async () => {
    const stock = parseInt(draft.stock, 10);
    if (!draft.value.trim() || isNaN(stock) || stock < 0) return;
    setBusyId("new");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, value: draft.value.trim(), stock }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(errorMessageForCode(data.code));
        return;
      }
      const created: VariantRow = await res.json();
      committedRef.current[created.id] = {
        name: created.name,
        value: created.value,
        stock: created.stock,
      };
      setRows((prev) => [...prev, created]);
      setDraft({ name: draft.name, value: "", stock: "0" });
      toast.success(t("toasts.added"));
      warnIfNoSwatch(created);
    } catch {
      toast.error(t("toasts.saveError"));
    } finally {
      setBusyId(null);
    }
  };

  const patchVariant = useCallback(
    async (id: string, patch: Partial<Pick<VariantRow, "name" | "value" | "stock">>) => {
      setBusyId(id);
      try {
        const res = await fetch(`${base}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(errorMessageForCode(data.code));
          // I2/G16 fix: the optimistic updateLocal() a blur handler already
          // applied is now wrong (the server rejected it, e.g. on
          // DUPLICATE_VARIANT) and was never rolled back before this fix —
          // a refetch is the simplest correct undo, discarding any local
          // drift across every row rather than trying to reconstruct just
          // this one's prior value.
          try {
            await refetchRows();
          } catch {
            // Best-effort: the error toast above already told the admin
            // something is wrong, and a failed refetch leaves the same
            // drifted value a manual reload would currently show anyway.
          }
          return;
        }
        const updated: VariantRow = await res.json();
        committedRef.current[id] = {
          name: updated.name,
          value: updated.value,
          stock: updated.stock,
        };
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
        toast.success(t("toasts.updated"));
        warnIfNoSwatch(updated);
      } catch {
        toast.error(t("toasts.saveError"));
      } finally {
        setBusyId(null);
      }
    },
    [base, t, errorMessageForCode, refetchRows, warnIfNoSwatch]
  );

  const deleteVariant = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${base}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(errorMessageForCode(data.code));
        return;
      }
      delete committedRef.current[id];
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success(t("toasts.deleted"));
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setBusyId(null);
    }
  };

  const updateLocal = (id: string, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const draftStock = parseInt(draft.stock, 10);
  const isDraftStockValid = !isNaN(draftStock) && draftStock >= 0;

  const nameSelect = (value: string, onChange: (v: VariantName) => void, disabled: boolean) => (
    <Select value={value} onValueChange={(v) => onChange(v as VariantName)} disabled={disabled}>
      <SelectTrigger aria-label={t("headers.name")}>
        <SelectValue placeholder={t("namePlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {NAME_OPTIONS.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* I4/G16 fix: shared suggestion list for every Колір value input
            below (existing rows + the add-draft row) — options are the
            known swatch keys, so a name typed close to "Темно-синій" is one
            autocomplete pick away from actually matching it. */}
        <datalist id={COLOR_DATALIST_ID}>
          {Object.keys(COLOR_SWATCH_CLASSES).map((color) => (
            <option key={color} value={color} />
          ))}
        </datalist>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> {tCommon("loading")}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            <div className="text-muted-foreground grid grid-cols-[1fr_1fr_6rem_2.5rem] gap-2 text-xs font-medium">
              <span>{t("headers.name")}</span>
              <span>{t("headers.value")}</span>
              <span>{t("headers.stock")}</span>
              <span className="sr-only">{t("headers.actions")}</span>
            </div>
            {rows.map((row) => {
              const busy = busyId === row.id;
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_1fr_6rem_2.5rem] items-center gap-2"
                >
                  {nameSelect(row.name, (name) => patchVariant(row.id, { name }), busy)}
                  <Input
                    aria-label={t("headers.value")}
                    value={row.value}
                    disabled={busy}
                    list={row.name === VARIANT_NAMES.color ? COLOR_DATALIST_ID : undefined}
                    onChange={(e) => updateLocal(row.id, { value: e.target.value })}
                    onBlur={(e) => {
                      // I2/G16 fix: an emptied value must not persist as a
                      // silently-skipped PATCH over an unchanged server row
                      // — revert the field to the last known-good value and
                      // say so, instead of leaving an empty box on screen
                      // indefinitely.
                      const value = e.target.value.trim();
                      if (!value) {
                        const committed = committedRef.current[row.id]?.value ?? row.value;
                        updateLocal(row.id, { value: committed });
                        toast.warning(t("toasts.valueRequired"));
                        return;
                      }
                      patchVariant(row.id, { value });
                    }}
                  />
                  <Input
                    aria-label={t("headers.stock")}
                    type="number"
                    min="0"
                    // Number.isNaN guard: NaN is the sentinel a cleared box
                    // is stored as below, and React warns if handed a raw
                    // NaN `value` — cast to "" explicitly instead.
                    value={Number.isNaN(row.stock) ? "" : row.stock}
                    disabled={busy}
                    onChange={(e) => {
                      // I2/G16 fix: previously `Number(e.target.value)`,
                      // which turns a cleared box into a silent local `0` —
                      // a value indistinguishable from a deliberately-set
                      // zero stock, so the drift below has no visible tell.
                      // NaN is a legal `number` and React renders a NaN
                      // value as an empty number input (the DOM rejects the
                      // literal string "NaN" as invalid, same as ""), so
                      // this keeps the field visibly empty instead of
                      // silently substituting 0.
                      const raw = e.target.value;
                      updateLocal(row.id, { stock: raw === "" ? NaN : Number(raw) });
                    }}
                    onBlur={(e) => {
                      const stock = parseInt(e.target.value, 10);
                      if (isNaN(stock) || stock < 0) {
                        const committed =
                          committedRef.current[row.id]?.stock ??
                          (Number.isNaN(row.stock) ? 0 : row.stock);
                        updateLocal(row.id, { stock: committed });
                        toast.warning(t("toasts.stockInvalid"));
                        return;
                      }
                      patchVariant(row.id, { stock });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tCommon("delete")}
                    disabled={busy}
                    onClick={() => deleteVariant(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-[1fr_1fr_6rem_auto] items-center gap-2 border-t pt-4">
          {nameSelect(draft.name, (name) => setDraft({ ...draft, name }), busyId === "new")}
          <Input
            aria-label={t("headers.value")}
            placeholder={t("valuePlaceholder")}
            value={draft.value}
            disabled={busyId === "new"}
            list={draft.name === VARIANT_NAMES.color ? COLOR_DATALIST_ID : undefined}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
          <Input
            aria-label={t("headers.stock")}
            type="number"
            min="0"
            value={draft.stock}
            disabled={busyId === "new"}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
          />
          <Button
            type="button"
            onClick={addVariant}
            // I2/G16 fix: addVariant already early-returns on an invalid
            // stock, but the button used to stay enabled — a clear-stock,
            // type-value, click sequence produced a silent no-op with no
            // toast and no error. Folding stock validity into `disabled`
            // means that click can no longer do nothing without feedback.
            disabled={busyId === "new" || !draft.value.trim() || !isDraftStockValid}
          >
            {busyId === "new" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
