import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { renderWithIntl } from "../helpers/render-with-intl";
import { Form } from "@/components/ui/form";
import { NpDeliveryFields, clearPickupPoint } from "@/components/checkout";
import type { CheckoutInput } from "@/lib/validations";
import {
  API_CITIES,
  API_BRANCHES,
  API_POSTOMATS,
  KYIV_CITY_REF,
  RAW_BRANCH_1,
  RAW_POSTOMAT_1001,
} from "../fixtures/nova-poshta";

const fetchMock = vi.fn();
const noop = () => {};
const captured: { form?: UseFormReturn<CheckoutInput> } = {};

function Harness({
  methodId,
  unavailable = false,
  onUnavailable = noop,
}: {
  methodId: string;
  unavailable?: boolean;
  onUnavailable?: () => void;
}) {
  const form = useForm<CheckoutInput>({
    defaultValues: {
      email: "",
      shippingAddress: { name: "", line1: "", city: "", state: "", country: "UA", phone: "" },
      shippingMethod: methodId,
    },
  });
  useEffect(() => {
    captured.form = form;
  }, [form]);
  return (
    <Form {...form}>
      <form>
        <NpDeliveryFields
          form={form}
          methodId={methodId}
          unavailable={unavailable}
          onUnavailable={onUnavailable}
          inputClass=""
        />
      </form>
    </Form>
  );
}

function json(body: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/shipping/np/cities")) return json(API_CITIES);
    if (url.includes("kind=postomat")) return json(API_POSTOMATS);
    return json(API_BRANCHES);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function pickCity() {
  fireEvent.change(screen.getByLabelText("Місто"), { target: { value: "Київ" } });
  fireEvent.click(await screen.findByRole("option", { name: /^Київ/ }));
}

async function pickPoint(label: string, name: RegExp) {
  fireEvent.focus(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("NpDeliveryFields", () => {
  it("a city then a branch fills all five delivery values", async () => {
    renderWithIntl(<Harness methodId="np-office" />);
    await pickCity();
    await pickPoint("Відділення", /Відділення №1:/);

    expect(captured.form!.getValues("shippingAddress")).toMatchObject({
      city: "Київ",
      state: "Київська обл.",
      npCityRef: KYIV_CITY_REF,
      line1: RAW_BRANCH_1.Description,
      npWarehouseRef: RAW_BRANCH_1.Ref,
    });
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls.some((u) => u.includes(`city=${KYIV_CITY_REF}`) && u.includes("kind=branch"))).toBe(
      true
    );
  });

  it("stores the postomat name byte-exact (quotes and apostrophe)", async () => {
    renderWithIntl(<Harness methodId="np-postomat" />);
    await pickCity();
    await pickPoint("Поштомат", /Поштомат "Нова Пошта" №1001/);

    expect(captured.form!.getValues("shippingAddress.line1")).toBe(RAW_POSTOMAT_1001.Description);
    expect(captured.form!.getValues("shippingAddress.npWarehouseRef")).toBe(RAW_POSTOMAT_1001.Ref);
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes("kind=postomat"))).toBe(
      true
    );
  });

  it("editing a chosen 90-character postomat keeps every query within the routes' 50-character cap and does not report unavailability (I2)", async () => {
    // The route answers 400 for q > 50, exactly as src/app/api/shipping/np/warehouses/route.ts does.
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/shipping/np/cities")) return json(API_CITIES);
      const q = new URL(url, "http://localhost").searchParams.get("q") ?? "";
      if (q.length > 50) return json({ code: "VALIDATION_ERROR" }, 400);
      return json(API_POSTOMATS);
    });
    const onUnavailable = vi.fn();
    renderWithIntl(<Harness methodId="np-postomat" onUnavailable={onUnavailable} />);
    await pickCity();
    await pickPoint("Поштомат", /Поштомат "Нова Пошта" №1001/);
    expect(RAW_POSTOMAT_1001.Description.length).toBeGreaterThan(80);
    fetchMock.mockClear();

    fireEvent.change(screen.getByLabelText("Поштомат"), {
      target: { value: RAW_POSTOMAT_1001.Description.slice(0, -1) },
    });
    const queries = () =>
      (fetchMock.mock.calls as unknown as [string][]).map(
        ([url]) => new URL(url, "http://localhost").searchParams.get("q") ?? ""
      );
    // The debounce settles on the edited draft after a first call with the stale empty query.
    await waitFor(() => expect(queries().some((q) => q !== "")).toBe(true));

    for (const q of queries()) expect(q.length).toBeLessThanOrEqual(50);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("keeps the point picker disabled until a city is chosen", () => {
    renderWithIntl(<Harness methodId="np-office" />);
    const point = screen.getByLabelText("Відділення");
    expect(point).toBeDisabled();
    expect(point).toHaveAttribute("placeholder", "Спершу оберіть місто");
  });

  it("editing the city after a choice clears the city and point refs", async () => {
    renderWithIntl(<Harness methodId="np-office" />);
    await pickCity();
    await pickPoint("Відділення", /Відділення №1:/);

    fireEvent.change(screen.getByLabelText("Місто"), { target: { value: "Ки" } });
    const address = captured.form!.getValues("shippingAddress");
    expect(address.npCityRef).toBeUndefined();
    expect(address.npWarehouseRef).toBeUndefined();
    expect(address.line1).toBe("");
  });

  it("clearPickupPoint drops the point and its ref", async () => {
    renderWithIntl(<Harness methodId="np-office" />);
    await pickCity();
    await pickPoint("Відділення", /Відділення №1:/);

    act(() => clearPickupPoint(captured.form!));
    expect(captured.form!.getValues("shippingAddress.line1")).toBe("");
    expect(captured.form!.getValues("shippingAddress.npWarehouseRef")).toBeUndefined();
    expect(captured.form!.getValues("shippingAddress.npCityRef")).toBe(KYIV_CITY_REF);
  });

  it("courier takes a typed street, not a pickup point", async () => {
    renderWithIntl(<Harness methodId="np-courier" />);
    expect(screen.queryByLabelText("Відділення")).toBeNull();
    fireEvent.change(screen.getByLabelText("Вулиця, будинок, квартира"), {
      target: { value: "вул. Хрещатик, 1" },
    });
    expect(captured.form!.getValues("shippingAddress.line1")).toBe("вул. Хрещатик, 1");
  });

  it("a failed directory call reports unavailability", async () => {
    fetchMock.mockImplementation(async () => json({ code: "NP_UNAVAILABLE" }, 502));
    const onUnavailable = vi.fn();
    renderWithIntl(<Harness methodId="np-office" onUnavailable={onUnavailable} />);
    fireEvent.change(screen.getByLabelText("Місто"), { target: { value: "Київ" } });
    // 400 ms debounce + the fetcher's 700 ms single retry before it gives up.
    await waitFor(() => expect(onUnavailable).toHaveBeenCalled(), { timeout: 4000 });
  });

  it("a single throttled (502) answer is retried and does not report unavailability", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: "NP_UNAVAILABLE" }, 502))
      .mockImplementation(async () => json(API_CITIES));
    const onUnavailable = vi.fn();
    renderWithIntl(<Harness methodId="np-office" onUnavailable={onUnavailable} />);
    fireEvent.change(screen.getByLabelText("Місто"), { target: { value: "Київ" } });
    await screen.findByRole("option", { name: /Київ/ }, { timeout: 4000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("manual mode renders today's free-text fields with the notice", () => {
    renderWithIntl(<Harness methodId="np-office" unavailable />);
    expect(screen.getByText(/не вдалося завантажити довідник нової пошти/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Місто")).not.toHaveAttribute("role", "combobox");
    fireEvent.change(screen.getByLabelText("Відділення / адреса"), {
      target: { value: "Відділення №12" },
    });
    expect(captured.form!.getValues("shippingAddress.line1")).toBe("Відділення №12");
  });
});
