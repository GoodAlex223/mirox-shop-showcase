"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export interface ComboboxPage {
  options: ComboboxOption[];
  truncated: boolean;
}

export interface NpComboboxProps {
  /** Forwarded by FormControl, so FormLabel and FormMessage reach the input. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** The form's display string while a choice is held; "" when nothing is chosen. */
  selectedLabel: string;
  /** The chosen option — or null the moment the customer edits the text (the choice is void). */
  onSelectOption: (option: ComboboxOption | null) => void;
  /** Throws on failure and honours the signal. Keep its identity stable (useCallback). */
  loadOptions: (query: string, signal: AbortSignal) => Promise<ComboboxPage>;
  onLoadError: () => void;
  /** 0 = list on focus with an empty query (pickup points); 2 = wait for two characters (cities). */
  minQueryLength: number;
  /**
   * Upper bound on the query sent to `loadOptions`. After a choice the input holds the
   * full point label (a postomat's runs ~90 characters), so one backspace would make that
   * the query, and the NP routes refuse anything over 50. Default: no clamp.
   */
  maxQueryLength?: number;
  texts: { loading: string; empty: string; truncated: string };
}

const DEBOUNCE_MS = 400;

/**
 * Accessible searchable picker — the ARIA 1.2 combobox pattern (G25 spec §5.6).
 * The listbox renders INLINE under the input, never in a portal, so mobile
 * keyboards and Radix focus handling stay out of it. A query is fetched once its
 * debounce settles; a newer query aborts the older request, so a slow stale
 * answer can never overwrite a newer one.
 */
export function NpCombobox({
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  placeholder,
  disabled = false,
  className,
  inputClassName,
  selectedLabel,
  onSelectOption,
  loadOptions,
  onLoadError,
  minQueryLength,
  maxQueryLength,
  texts,
}: NpComboboxProps) {
  const listboxId = useId();
  // null = show the held choice (selectedLabel); a string = what is being typed.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // The settled outcome of the last load, keyed by BOTH the query and the loader that
  // produced it: a new loadOptions (e.g. another city's branches) must not show the
  // old loader's rows for the same query. result === null means the load failed.
  const [page, setPage] = useState<{
    query: string;
    load: NpComboboxProps["loadOptions"];
    result: ComboboxPage | null;
  } | null>(null);
  // onLoadError carries no stability contract, so it is read through a ref rather than
  // listed as an effect dependency (an inline callback would refetch on every render).
  const onLoadErrorRef = useRef(onLoadError);
  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  });

  const typed = (draft ?? "").trim();
  const query = useDebounce(
    (maxQueryLength === undefined ? typed : typed.slice(0, maxQueryLength)).trim(),
    DEBOUNCE_MS
  );
  const listing = open && !disabled && query.length >= minQueryLength;

  useEffect(() => {
    if (!listing) return;
    const controller = new AbortController();
    loadOptions(query, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setPage({ query, load: loadOptions, result });
        setActiveIndex(-1);
      },
      () => {
        if (controller.signal.aborted) return;
        // Settle as failed so the loading row stops; never as empty ("nothing found" would lie).
        setPage({ query, load: loadOptions, result: null });
        onLoadErrorRef.current();
      }
    );
    return () => controller.abort();
  }, [listing, query, loadOptions]);

  const settled = page?.query === query && page.load === loadOptions ? page : null;
  const failed = settled !== null && settled.result === null;
  const current = settled?.result ?? null;
  const showList = listing && !failed;
  const options = showList && current ? current.options : [];
  const loading = showList && !settled;

  useEffect(() => {
    if (!showList || activeIndex < 0) return;
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [showList, activeIndex, listboxId]);

  const choose = (option: ComboboxOption) => {
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
    onSelectOption(option);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const option = options[activeIndex];
      if (showList && option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-describedby={describedBy}
        aria-invalid={invalid}
        placeholder={placeholder}
        disabled={disabled}
        value={draft ?? selectedLabel}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (selectedLabel) onSelectOption(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          // Keeps focus in the input while a row or the scrollbar is pressed,
          // so the input's blur does not close the list under the pointer.
          onMouseDown={(event) => event.preventDefault()}
          className="bg-card border-border-strong absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-[10px] border py-1 shadow-lg"
        >
          {loading ? (
            <li
              role="presentation"
              className="text-muted-foreground flex items-center gap-2 px-3.5 py-3 text-sm"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {texts.loading}
            </li>
          ) : options.length === 0 ? (
            <li role="presentation" className="text-muted-foreground px-3.5 py-3 text-sm">
              {texts.empty}
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.value}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => choose(option)}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col justify-center px-3.5 py-2 text-sm",
                  index === activeIndex && "bg-muted"
                )}
              >
                <span className="font-semibold">{option.label}</span>
                {option.description && (
                  <span className="text-muted-foreground text-xs">{option.description}</span>
                )}
              </li>
            ))
          )}
          {!loading && current?.truncated && options.length > 0 && (
            <li
              role="presentation"
              className="text-muted-foreground border-border border-t px-3.5 py-2 text-xs"
            >
              {texts.truncated}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
