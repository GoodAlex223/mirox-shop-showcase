/**
 * Nova Poshta fixtures (G25). Records are trimmed copies of live responses
 * captured 2026-10-04 from https://api.novaposhta.ua/v2.0/json/ (keyless) —
 * only the fields our code reads are kept. MIXED_WAREHOUSES is a COMPOSED page,
 * one record per category plus the Кибляри `Store` point from another city and
 * two SYNTHETIC rows (marked) — not a single NP response.
 */
export const KYIV_CITY_REF = "8d5a980d-391c-11dd-90d9-001a92567626";

export const RAW_CITY_KYIV = {
  Ref: KYIV_CITY_REF,
  Description: "Київ",
  AreaDescription: "Київська",
};

export const RAW_CITY_KYIVETS = {
  Ref: "6dbe5985-96d1-11ea-a970-b8830365ade4",
  Description: "Київець",
  AreaDescription: "Львівська",
};

export const RAW_BRANCH_1 = {
  Ref: "1ec09d88-e1c2-11e3-8c4a-0050568002cf",
  Number: "1",
  Description: "Відділення №1: вул. Пирогівський шлях, 135",
  CategoryOfWarehouse: "Branch",
  TypeOfWarehouse: "9a68df70-0267-42a8-bb5c-37f427e36ee4",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
};

export const RAW_DROPOFF_920 = {
  Ref: "02c2c269-68a0-11ec-9014-b8830365bd14",
  Number: "920",
  Description: "Пункт №920 (до 10 кг): просп. Червоної Калини, 54А (АЗК БРСМ)",
  CategoryOfWarehouse: "DropOff",
  TypeOfWarehouse: "841339c7-591a-42e2-8233-7a0a00f0ed6f",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
};

/** Same TYPE as RAW_BRANCH_1 («Вантажне») — the reason branches are filtered by category. */
export const RAW_FULFILLMENT_3 = {
  Ref: "7a068734-7e4d-11ee-9eb1-d4f5ef0df2b8",
  Number: "900",
  Description: "Склад №3 (Фулфілмент Київ) с.Проліски: вул. Броварська, 2ж",
  CategoryOfWarehouse: "Fulfillment",
  TypeOfWarehouse: "9a68df70-0267-42a8-bb5c-37f427e36ee4",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
};

export const RAW_POSTOMAT_1001 = {
  Ref: "8e00619f-76b4-11eb-ac16-b8830365bd14",
  Number: "1001",
  Description:
    'Поштомат "Нова Пошта" №1001: вул. Сім\'ї Кульженків, 31а (Біля паркану, ближче до садочка)',
  CategoryOfWarehouse: "Postomat",
  TypeOfWarehouse: "f9316480-5f2d-425d-bc2c-ac7cd29decf0",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
};

/** Кибляри's ONLY point — a village with no `Branch` at all. */
export const RAW_STORE_KYBLIARY = {
  Ref: "c553c753-9912-11ea-a768-b8830365bd14",
  Number: "1",
  Description: "Пункт приймання-видачі (до 30 кг): вул. б.н., 82",
  CategoryOfWarehouse: "Store",
  TypeOfWarehouse: "841339c7-591a-42e2-8233-7a0a00f0ed6f",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
};

/** SYNTHETIC: a branch NP marks unselectable. */
export const RAW_BRANCH_DENIED = {
  ...RAW_BRANCH_1,
  Ref: "00000000-0000-0000-0000-000000000001",
  Number: "2",
  Description: "Відділення №2 (synthetic: DenyToSelect)",
  DenyToSelect: "1",
};

/** SYNTHETIC: a branch that is not Working. */
export const RAW_BRANCH_CLOSED = {
  ...RAW_BRANCH_1,
  Ref: "00000000-0000-0000-0000-000000000002",
  Number: "3",
  Description: "Відділення №3 (synthetic: not Working)",
  WarehouseStatus: "NotWorking",
};

export const MIXED_WAREHOUSES = [
  RAW_BRANCH_1,
  RAW_DROPOFF_920,
  RAW_FULFILLMENT_3,
  RAW_POSTOMAT_1001,
  RAW_STORE_KYBLIARY,
  RAW_BRANCH_DENIED,
  RAW_BRANCH_CLOSED,
];

/** The classic-API success envelope. */
export function npEnvelope<T>(data: T[], totalCount = data.length) {
  return { success: true, data, errors: [], warnings: [], info: { totalCount } };
}

/** Live answer to a well-formed but unknown key (2026-10-04). */
export const NP_KEY_EXPIRED = {
  success: false,
  data: [],
  errors: ["API key expired"],
  warnings: [],
  info: [],
  errorCodes: ["20000201204"],
};

/** Our routes' 200 bodies — for component tests and the Playwright stub. */
export const API_CITIES = {
  items: [{ ref: KYIV_CITY_REF, name: "Київ", area: "Київська" }],
};

export const API_BRANCHES = {
  items: [
    { ref: RAW_BRANCH_1.Ref, number: RAW_BRANCH_1.Number, name: RAW_BRANCH_1.Description },
    { ref: RAW_DROPOFF_920.Ref, number: RAW_DROPOFF_920.Number, name: RAW_DROPOFF_920.Description },
  ],
  truncated: false,
};

export const API_POSTOMATS = {
  items: [
    {
      ref: RAW_POSTOMAT_1001.Ref,
      number: RAW_POSTOMAT_1001.Number,
      name: RAW_POSTOMAT_1001.Description,
    },
  ],
  truncated: false,
};
