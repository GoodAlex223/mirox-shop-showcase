// Category seed data with hierarchy

export const topLevelCategories = [
  {
    name: "Одяг",
    slug: "odyah",
    description: "Чоловічий одяг Mirox — худі, футболки, штани та олімпійки",
    image: "/images/products/p-hudi-basic.png",
    sortOrder: 1,
  },
  {
    name: "Аксесуари",
    slug: "aksesuary",
    description: "Аксесуари Mirox — кепки та доповнення до образу",
    image: "/images/products/p-cap.png",
    sortOrder: 2,
  },
];

export const subcategories = [
  {
    name: "Худі",
    slug: "hudi",
    description: "Худі Mirox — базові, oversize та зимові",
    parentSlug: "odyah",
    sortOrder: 1,
  },
  {
    name: "Футболки",
    slug: "futbolky",
    description: "Футболки Mirox з щільної бавовни",
    parentSlug: "odyah",
    sortOrder: 2,
  },
  {
    name: "Лонгсліви",
    slug: "longslivy",
    description: "Лонгсліви Mirox на прохолодну погоду",
    parentSlug: "odyah",
    sortOrder: 3,
  },
  {
    name: "Олімпійки",
    slug: "olimpiyky",
    description: "Олімпійки Mirox на блискавці",
    parentSlug: "odyah",
    sortOrder: 4,
  },
  {
    name: "Штани",
    slug: "shtany",
    description: "Штани та карго Mirox",
    parentSlug: "odyah",
    sortOrder: 5,
  },
  {
    name: "Кепки",
    slug: "kepky",
    description: "Кепки Mirox з вишитим логотипом",
    parentSlug: "aksesuary",
    sortOrder: 1,
  },
  {
    name: "Светри",
    slug: "svetry",
    description: "Светри Mirox — в'язані та на блискавці",
    parentSlug: "odyah",
    sortOrder: 6,
  },
  {
    name: "Рюкзаки",
    slug: "ryukzaky",
    description: "Рюкзаки та ранці Mirox",
    parentSlug: "aksesuary",
    sortOrder: 2,
  },
];
