// Product seed data — Mirox clothing catalog (UA, UAH)

import { VARIANT_NAMES } from "../../src/lib/variant-names";

// Same pattern as seed-data/orders.ts: `now` is captured once at module load
// (i.e. whenever `npm run db:seed` runs), and every product's `createdAt` is
// expressed relative to it. That keeps the RELATIVE recency ordering between
// products stable across reseeds (Basic is always "newer" than White by 12
// days, whatever day the seed actually runs) — which is all the homepage's
// "Новинки" rail (orderBy createdAt desc) actually needs. Explicit, strictly
// decreasing values here are what makes the rail order deterministic instead
// of depending on insertion order or DB default timestamps: the first four —
// Basic, Футболка, Олімпійка, White — are the mockup's featured four, in the
// mockup's exact order (handoff rail: Task 6 / TASK-057).
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

export interface ProductSeed {
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDesc: string;
  price: number;
  comparePrice?: number;
  /** Colorway-sibling link: products sharing a styleGroup are the same garment
   *  in different colors; the PDP renders their swatches as links (TASK-037).
   *  Exactly one Color variant row per product — the product's true colorway. */
  styleGroup?: string;
  stock: number;
  isFeatured: boolean;
  categorySlug: string;
  brand: string;
  // Omitted for the whole catalog: these placeholder products have no real
  // GTIN/MPN identifiers. Optional here — and in the `products` schema —
  // so the Google Shopping feed's Zod validation just drops these items
  // rather than the seed failing.
  barcode?: string;
  mpn?: string;
  images: { url: string; alt: string; position: number }[];
  variants?: { name: string; value: string; stock: number }[];
  createdAt: Date;
}

export const products: ProductSeed[] = [
  {
    name: "Худі Mirox Basic",
    slug: "hudi-mirox-basic",
    sku: "MRX-001",
    description:
      "Базове чорне худі Mirox з щільного футеру (400 г/м²) з начосом. Оверсайз-крій, посилені шви, капюшон з подвійним шаром та металеві люверси. Вишитий логотип на грудях. Не втрачає форму після прання.",
    shortDesc: "Базове худі з щільного футеру з начосом",
    price: 1290,
    styleGroup: "hudi-mirox",
    stock: 42,
    isFeatured: true,
    categorySlug: "hudi",
    brand: "Mirox",
    createdAt: daysAgo(4),
    images: [
      {
        url: "/images/products/p-hudi-basic.png",
        alt: "Худі Mirox Basic — вид спереду",
        position: 0,
      },
      { url: "/images/products/pd-main.png", alt: "Худі Mirox Basic — основне фото", position: 1 },
      // pd-thumb-1.png removed (TASK-057 fix wave): it was byte-identical to
      // pd-main.png above, duplicating the same frame in the gallery. The
      // remaining pd-thumb-2..5 files already carry "деталь 2".."деталь 5" alt
      // text and slot into position 2..5 unchanged — no renumbering needed
      // beyond removing this one entry.
      { url: "/images/products/pd-thumb-2.png", alt: "Худі Mirox Basic — деталь 2", position: 2 },
      { url: "/images/products/pd-thumb-3.png", alt: "Худі Mirox Basic — деталь 3", position: 3 },
      { url: "/images/products/pd-thumb-4.png", alt: "Худі Mirox Basic — деталь 4", position: 4 },
      { url: "/images/products/pd-thumb-5.png", alt: "Худі Mirox Basic — деталь 5", position: 5 },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 8 },
      { name: VARIANT_NAMES.size, value: "M", stock: 12 },
      { name: VARIANT_NAMES.size, value: "L", stock: 12 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 10 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 30 },
    ],
  },
  {
    name: "Футболка Mirox",
    slug: "futbolka-mirox",
    sku: "MRX-002",
    description:
      "Футболка Mirox із щільної бавовни (180 г/м²) з м'якою фактурою та гладким плетінням. Пряма посадка, посилені шви на комірі, вишитий логотип на грудях. Дихаюча тканина не деформується після прання і зберігає насичений колір.",
    shortDesc: "Футболка з щільної бавовни з прямою посадкою",
    price: 590,
    comparePrice: 690,
    stock: 96,
    isFeatured: true,
    categorySlug: "futbolky",
    brand: "Mirox",
    createdAt: daysAgo(8),
    images: [
      { url: "/images/products/p-tshirt.png", alt: "Футболка Mirox — вид спереду", position: 0 },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 20 },
      { name: VARIANT_NAMES.size, value: "M", stock: 28 },
      { name: VARIANT_NAMES.size, value: "L", stock: 28 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 20 },
      // p-tshirt.png depicts the white tee — colour must match the photo (gate fix 2026-08-03)
      { name: VARIANT_NAMES.color, value: "Білий", stock: 64 },
    ],
  },
  {
    name: "Олімпійка Mirox",
    slug: "olimpiyka-mirox",
    sku: "MRX-003",
    description:
      "Олімпійка Mirox на металевій блискавці з трикотажу з начосом зсередини. Прямий крій, високий комір-стійка, кишені по боках та манжети на резинці. Вишитий логотип на грудях підкреслює лаконічний стиль.",
    shortDesc: "Олімпійка на блискавці з начосом зсередини",
    price: 1490,
    stock: 50,
    isFeatured: true,
    categorySlug: "olimpiyky",
    brand: "Mirox",
    createdAt: daysAgo(12),
    images: [
      { url: "/images/products/p-olimp.png", alt: "Олімпійка Mirox — вид спереду", position: 0 },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 10 },
      { name: VARIANT_NAMES.size, value: "M", stock: 15 },
      { name: VARIANT_NAMES.size, value: "L", stock: 15 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 10 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 50 },
    ],
  },
  {
    name: "Худі Mirox White",
    slug: "hudi-mirox-white",
    sku: "MRX-004",
    description:
      "Худі Mirox White — світла версія базової моделі з щільного футеру (400 г/м²) з начосом. Оверсайз-крій, капюшон з регульованим шнурком та кишеня-кенгуру спереду. Вишитий логотип на грудях, тканина не жовтіє після прання.",
    shortDesc: "Біле худі з щільного футеру, оверсайз-крій",
    price: 1290,
    comparePrice: 1490,
    styleGroup: "hudi-mirox",
    stock: 38,
    isFeatured: true,
    categorySlug: "hudi",
    brand: "Mirox",
    createdAt: daysAgo(16),
    images: [
      {
        url: "/images/products/p-hudi-white.png",
        alt: "Худі Mirox White — вид спереду",
        position: 0,
      },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 8 },
      { name: VARIANT_NAMES.size, value: "M", stock: 11 },
      { name: VARIANT_NAMES.size, value: "L", stock: 11 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 8 },
      { name: VARIANT_NAMES.color, value: "Білий", stock: 38 },
    ],
  },
  {
    name: "Худі Mirox Oversize",
    slug: "hudi-mirox-oversize",
    sku: "MRX-005",
    description:
      "Худі Mirox Oversize — вільний силует з подовженою лінією плеча та щільного футеру з начосом. Об'ємний капюшон, широкі манжети та кишеня-кенгуру. Створене для тих, хто цінує максимальний комфорт і стріт-стиль.",
    shortDesc: "Худі вільного крою з подовженою лінією плеча",
    price: 1390,
    stock: 34,
    isFeatured: false,
    categorySlug: "hudi",
    brand: "Mirox",
    createdAt: daysAgo(30),
    images: [
      {
        url: "/images/products/p-hudi-oversize.png",
        alt: "Худі Mirox Oversize — вид спереду",
        position: 0,
      },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "M", stock: 10 },
      { name: VARIANT_NAMES.size, value: "L", stock: 10 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 9 },
      { name: VARIANT_NAMES.size, value: "XXL", stock: 5 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 34 },
    ],
  },
  {
    name: "Штани Mirox Cargo",
    slug: "shtany-mirox-cargo",
    sku: "MRX-006",
    description:
      "Штани Mirox Cargo з щільної бавовняної тканини з накладними кишенями по боках. Прямий крій, регульований пояс на шнурку, манжети на резинці знизу. Практичні та зносостійкі — підходять як для щоденних образів, так і для активного відпочинку.",
    shortDesc: "Штани карго з накладними кишенями",
    price: 1190,
    stock: 27,
    isFeatured: false,
    categorySlug: "shtany",
    brand: "Mirox",
    createdAt: daysAgo(35),
    images: [
      { url: "/images/products/p-cargo.png", alt: "Штани Mirox Cargo — вид спереду", position: 0 },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 8 },
      { name: VARIANT_NAMES.size, value: "M", stock: 10 },
      { name: VARIANT_NAMES.size, value: "L", stock: 9 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 27 },
    ],
  },
  {
    name: "Лонгслів Mirox",
    slug: "longsliv-mirox",
    sku: "MRX-007",
    description:
      "Лонгслів Mirox з тонкого трикотажу щільного плетіння для прохолодної погоди. Прямий крій, манжети на резинці, вишитий логотип на грудях. Легко поєднується з худі чи олімпійкою як базовий шар.",
    shortDesc: "Лонгслів з тонкого трикотажу на прохолодну погоду",
    price: 690,
    stock: 44,
    isFeatured: false,
    categorySlug: "longslivy",
    brand: "Mirox",
    createdAt: daysAgo(40),
    images: [
      {
        url: "/images/products/p-longsleeve.png",
        alt: "Лонгслів Mirox — вид спереду",
        position: 0,
      },
    ],
    variants: [
      { name: VARIANT_NAMES.size, value: "S", stock: 10 },
      { name: VARIANT_NAMES.size, value: "M", stock: 13 },
      { name: VARIANT_NAMES.size, value: "L", stock: 13 },
      { name: VARIANT_NAMES.size, value: "XL", stock: 8 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 44 },
    ],
  },
  {
    name: "Кепка Mirox",
    slug: "kepka-mirox",
    sku: "MRX-008",
    description:
      "Кепка Mirox з щільного бавовняного твілу з вишитим логотипом спереду. Регульований застібок ззаду підходить під будь-який обхват голови, вигнутий козирок захищає від сонця. Універсальний аксесуар, що завершує образ.",
    shortDesc: "Кепка з вишитим логотипом і регульованим застібком",
    price: 490,
    stock: 60,
    isFeatured: false,
    categorySlug: "kepky",
    brand: "Mirox",
    createdAt: daysAgo(45),
    images: [{ url: "/images/products/p-cap.png", alt: "Кепка Mirox — вид спереду", position: 0 }],
    variants: [
      { name: VARIANT_NAMES.size, value: "Один розмір", stock: 60 },
      { name: VARIANT_NAMES.color, value: "Чорний", stock: 60 },
    ],
  },
];
