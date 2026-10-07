import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import {
  NpCombobox,
  type ComboboxOption,
  type ComboboxPage,
} from "@/components/checkout/NpCombobox";

const TEXTS = {
  loading: "Завантаження…",
  empty: "Нічого не знайдено",
  truncated: "Показано не всі — уточніть номер або вулицю",
};

// Two real same-named places (spec §3, getCities «Біла Ц»): only the oblast tells them apart.
const BILA_TSERKVA: ComboboxOption[] = [
  { value: "a", label: "Біла Церква", description: "Київська обл." },
  { value: "b", label: "Біла Церква", description: "Закарпатська обл." },
];

function setup(overrides: Partial<ComponentProps<typeof NpCombobox>> = {}) {
  const onSelectOption = vi.fn();
  const onLoadError = vi.fn();
  const loadOptions = vi.fn(
    async (): Promise<ComboboxPage> => ({ options: BILA_TSERKVA, truncated: false })
  );
  render(
    <>
      <label htmlFor="city">Місто</label>
      <NpCombobox
        id="city"
        selectedLabel=""
        onSelectOption={onSelectOption}
        loadOptions={loadOptions}
        onLoadError={onLoadError}
        minQueryLength={2}
        texts={TEXTS}
        {...overrides}
      />
    </>
  );
  const input = screen.getByRole("combobox", { name: "Місто" });
  return { input, onSelectOption, onLoadError, loadOptions };
}

describe("NpCombobox", () => {
  it("does not search below the minimum query length", async () => {
    const { input, loadOptions } = setup();
    fireEvent.change(input, { target: { value: "Б" } });
    // longer than the 400 ms typing pause, so a search WOULD have fired by now
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(loadOptions).not.toHaveBeenCalled();
  });

  it("waits the 400 ms typing pause before searching", async () => {
    vi.useFakeTimers();
    try {
      const { input, loadOptions } = setup();
      fireEvent.change(input, { target: { value: "Біла" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(399);
      });
      expect(loadOptions).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(loadOptions).toHaveBeenCalledWith("Біла", expect.any(AbortSignal));
    } finally {
      vi.useRealTimers();
    }
  });

  it("searches the debounced query and lists same-named places by oblast", async () => {
    const { input, loadOptions } = setup();
    fireEvent.change(input, { target: { value: "Біла" } });

    expect(await screen.findAllByRole("option")).toHaveLength(2);
    expect(screen.getByText("Київська обл.")).toBeInTheDocument();
    expect(screen.getByText("Закарпатська обл.")).toBeInTheDocument();
    expect(loadOptions).toHaveBeenCalledWith("Біла", expect.any(AbortSignal));
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("selects with the keyboard and tracks the active option", async () => {
    const { input, onSelectOption } = setup();
    fireEvent.change(input, { target: { value: "Біла" } });
    await screen.findAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toHaveTextContent("Закарпатська обл.");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelectOption).toHaveBeenCalledWith(BILA_TSERKVA[1]);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("clamps the debounced query to maxQueryLength (I2: editing a held 60-character label)", async () => {
    const held = "Пункт №920 (до 10 кг): просп. Червоної Калини, 54А".padEnd(60, ".");
    expect(held).toHaveLength(60);
    const { input, loadOptions } = setup({
      selectedLabel: held,
      minQueryLength: 0,
      maxQueryLength: 50,
    });
    // One backspace on the held label: the draft becomes the label minus a character.
    fireEvent.change(input, { target: { value: held.slice(0, -1) } });

    // The debounce settles on the edited draft after a first call with the stale empty query.
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(held.slice(0, 50), expect.any(AbortSignal))
    );
    for (const [query] of loadOptions.mock.calls as unknown as [string][]) {
      expect(query.length).toBeLessThanOrEqual(50);
    }
  });

  it("does not clamp the query when maxQueryLength is not set", async () => {
    const long = "а".repeat(60);
    const { input, loadOptions } = setup();
    fireEvent.change(input, { target: { value: long } });
    await waitFor(() => expect(loadOptions).toHaveBeenCalledWith(long, expect.any(AbortSignal)));
  });

  it("selects on click", async () => {
    const { input, onSelectOption } = setup();
    fireEvent.change(input, { target: { value: "Біла" } });
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    expect(onSelectOption).toHaveBeenCalledWith(BILA_TSERKVA[0]);
  });

  it("closes on Escape", async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "Біла" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("voids a held choice the moment the text is edited", () => {
    const { input, onSelectOption } = setup({ selectedLabel: "Київ" });
    expect(input).toHaveValue("Київ");
    fireEvent.change(input, { target: { value: "Ки" } });
    expect(onSelectOption).toHaveBeenCalledWith(null);
    expect(input).toHaveValue("Ки");
  });

  it("ignores a slow answer to an older query", async () => {
    const resolvers: Record<string, (page: ComboboxPage) => void> = {};
    const loadOptions = vi.fn(
      (query: string) =>
        new Promise<ComboboxPage>((resolve) => {
          resolvers[query] = resolve;
        })
    );
    const { input } = setup({ loadOptions });

    fireEvent.change(input, { target: { value: "Ки" } });
    await waitFor(() => expect(resolvers["Ки"]).toBeDefined());
    fireEvent.change(input, { target: { value: "Київ" } });
    await waitFor(() => expect(resolvers["Київ"]).toBeDefined());

    act(() => resolvers["Київ"]({ options: [{ value: "k", label: "Київ" }], truncated: false }));
    expect(await screen.findByRole("option", { name: "Київ" })).toBeInTheDocument();

    act(() => resolvers["Ки"]({ options: [{ value: "x", label: "Кибляри" }], truncated: false }));
    expect(screen.queryByRole("option", { name: "Кибляри" })).toBeNull();
    // The abort guard must leave the newer answer in place, not just hide the stale one.
    expect(screen.getByRole("option", { name: "Київ" })).toBeInTheDocument();
  });

  it("does not show one loader's cached page for a different loader", async () => {
    const page = (label: string): ComboboxPage => ({
      options: [{ value: label, label }],
      truncated: false,
    });
    const first = vi.fn(async () => page("Відділення міста А"));
    let resolveSecond!: (value: ComboboxPage) => void;
    const second = vi.fn(
      () =>
        new Promise<ComboboxPage>((resolve) => {
          resolveSecond = resolve;
        })
    );
    const props = {
      selectedLabel: "",
      onSelectOption: vi.fn(),
      onLoadError: vi.fn(),
      minQueryLength: 0,
      texts: TEXTS,
    };
    const { rerender } = render(<NpCombobox id="branch" loadOptions={first} {...props} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Відділення міста А" })).toBeInTheDocument();

    rerender(<NpCombobox id="branch" loadOptions={second} {...props} />);
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("option", { name: "Відділення міста А" })).toBeNull();
    expect(screen.getByText(TEXTS.loading)).toBeInTheDocument();

    act(() => resolveSecond(page("Відділення міста Б")));
    expect(await screen.findByRole("option", { name: "Відділення міста Б" })).toBeInTheDocument();
  });

  it("does not refetch when only onLoadError changes identity", async () => {
    const loadOptions = vi.fn(
      async (): Promise<ComboboxPage> => ({ options: [], truncated: false })
    );
    const props = { selectedLabel: "", onSelectOption: vi.fn(), minQueryLength: 0, texts: TEXTS };
    const { rerender } = render(
      <NpCombobox id="x" loadOptions={loadOptions} onLoadError={() => {}} {...props} />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByText(TEXTS.empty)).toBeInTheDocument();
    rerender(<NpCombobox id="x" loadOptions={loadOptions} onLoadError={() => {}} {...props} />);
    rerender(<NpCombobox id="x" loadOptions={loadOptions} onLoadError={() => {}} {...props} />);
    expect(loadOptions).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onLoadError, not the one from the render that started the load", async () => {
    let reject!: (error: Error) => void;
    const loadOptions = vi.fn(
      () =>
        new Promise<ComboboxPage>((_, rej) => {
          reject = rej;
        })
    );
    const stale = vi.fn();
    const latest = vi.fn();
    const props = { selectedLabel: "", onSelectOption: vi.fn(), minQueryLength: 0, texts: TEXTS };
    const { rerender } = render(
      <NpCombobox id="x" loadOptions={loadOptions} onLoadError={stale} {...props} />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));
    rerender(<NpCombobox id="x" loadOptions={loadOptions} onLoadError={latest} {...props} />);
    await act(async () => reject(new Error("502")));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
    expect(loadOptions).toHaveBeenCalledTimes(1);
  });

  it("scrolls the active option into view", async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      const { input } = setup();
      fireEvent.change(input, { target: { value: "Біла" } });
      await screen.findAllByRole("option");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getAllByRole("option")[0]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("reports a failed load", async () => {
    const loadOptions = vi.fn(async () => {
      throw new Error("502");
    });
    const { input, onLoadError } = setup({ loadOptions });
    fireEvent.change(input, { target: { value: "Київ" } });
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1));
  });

  it("stops showing the loading row after a failed load, without claiming nothing was found", async () => {
    const loadOptions = vi.fn(async () => {
      throw new Error("502");
    });
    const { input, onLoadError } = setup({ loadOptions });
    fireEvent.change(input, { target: { value: "Київ" } });
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(TEXTS.loading)).toBeNull());
    expect(screen.queryByText(TEXTS.empty)).toBeNull();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("retries after a failure once the query changes", async () => {
    const loadOptions = vi
      .fn<(query: string, signal: AbortSignal) => Promise<ComboboxPage>>()
      .mockRejectedValueOnce(new Error("502"))
      .mockResolvedValue({ options: [{ value: "k", label: "Київ" }], truncated: false });
    const { input, onLoadError } = setup({ loadOptions });
    fireEvent.change(input, { target: { value: "Ки" } });
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Київ" } });
    expect(await screen.findByRole("option", { name: "Київ" })).toBeInTheDocument();
  });

  it("loads on focus when the minimum query length is 0", async () => {
    const { input, loadOptions } = setup({ minQueryLength: 0 });
    fireEvent.focus(input);
    await waitFor(() => expect(loadOptions).toHaveBeenCalledWith("", expect.any(AbortSignal)));
  });

  it("shows the empty text when nothing matches", async () => {
    const empty = vi.fn(async (): Promise<ComboboxPage> => ({ options: [], truncated: false }));
    const { input } = setup({ loadOptions: empty });
    fireEvent.change(input, { target: { value: "Ххх" } });
    expect(await screen.findByText(TEXTS.empty)).toBeInTheDocument();
  });

  it("shows the truncated hint under the options", async () => {
    const truncated = vi.fn(
      async (): Promise<ComboboxPage> => ({ options: BILA_TSERKVA, truncated: true })
    );
    const { input } = setup({ loadOptions: truncated });
    fireEvent.change(input, { target: { value: "Біла" } });
    expect(await screen.findByText(TEXTS.truncated)).toBeInTheDocument();
  });

  it("does not search while disabled", async () => {
    const { input, loadOptions } = setup({ disabled: true, minQueryLength: 0 });
    fireEvent.focus(input);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(loadOptions).not.toHaveBeenCalled();
  });
});
