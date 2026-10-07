// Order seed data with various statuses

// Dates for realistic order history (backdated 1-3 months)
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

export const orders = [
  // DELIVERED orders (for reviews)
  {
    orderNumber: "ORD-2026-0001",
    customerEmail: "customer@example.com",
    status: "DELIVERED",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Олександр Петренко",
      addressLine1: "вул. Хрещатик, 12, кв. 4",
      city: "Київ",
      state: "Київська обл.",
      postalCode: "01001",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-001",
        productName: "Худі Mirox Basic",
        quantity: 1,
        unitPrice: 1290,
      },
      {
        productSku: "MRX-003",
        productName: "Олімпійка Mirox",
        quantity: 1,
        unitPrice: 1490,
      },
    ],
    createdAt: daysAgo(45),
  },
  {
    orderNumber: "ORD-2026-0002",
    customerEmail: "sarah.wilson@example.com",
    status: "DELIVERED",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Дмитро Коваленко",
      addressLine1: "вул. Личаківська, 45",
      city: "Львів",
      state: "Львівська обл.",
      postalCode: "79000",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-002",
        productName: "Футболка Mirox",
        quantity: 2,
        unitPrice: 590,
      },
      {
        productSku: "MRX-004",
        productName: "Худі Mirox White",
        quantity: 1,
        unitPrice: 1290,
      },
    ],
    createdAt: daysAgo(38),
  },
  {
    orderNumber: "ORD-2026-0003",
    customerEmail: "mike.johnson@example.com",
    status: "DELIVERED",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Марія Шевченко",
      addressLine1: "вул. Дерибасівська, 8, кв. 12",
      city: "Одеса",
      state: "Одеська обл.",
      postalCode: "65000",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-005",
        productName: "Худі Mirox Oversize",
        quantity: 1,
        unitPrice: 1390,
      },
      {
        productSku: "MRX-007",
        productName: "Лонгслів Mirox",
        quantity: 2,
        unitPrice: 690,
      },
    ],
    createdAt: daysAgo(30),
  },
  {
    orderNumber: "ORD-2026-0004",
    customerEmail: "emily.chen@example.com",
    status: "DELIVERED",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Ірина Бондаренко",
      addressLine1: "вул. Сумська, 21",
      city: "Харків",
      state: "Харківська обл.",
      postalCode: "61000",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-003",
        productName: "Олімпійка Mirox",
        quantity: 1,
        unitPrice: 1490,
      },
      {
        productSku: "MRX-004",
        productName: "Худі Mirox White",
        quantity: 1,
        unitPrice: 1290,
      },
    ],
    createdAt: daysAgo(25),
  },
  // SHIPPED order
  {
    orderNumber: "ORD-2026-0005",
    customerEmail: "customer@example.com",
    status: "SHIPPED",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Олександр Петренко",
      addressLine1: "вул. Хрещатик, 12, кв. 4",
      city: "Київ",
      state: "Київська обл.",
      postalCode: "01001",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-006",
        productName: "Штани Mirox Cargo",
        quantity: 1,
        unitPrice: 1190,
      },
    ],
    createdAt: daysAgo(7),
  },
  // PROCESSING order
  {
    orderNumber: "ORD-2026-0006",
    customerEmail: "sarah.wilson@example.com",
    status: "PROCESSING",
    paymentStatus: "PAID",
    shippingAddress: {
      fullName: "Дмитро Коваленко",
      addressLine1: "вул. Личаківська, 45",
      city: "Львів",
      state: "Львівська обл.",
      postalCode: "79000",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-008",
        productName: "Кепка Mirox",
        quantity: 1,
        unitPrice: 490,
      },
      {
        productSku: "MRX-001",
        productName: "Худі Mirox Basic",
        quantity: 1,
        unitPrice: 1290,
      },
    ],
    createdAt: daysAgo(3),
  },
  // PENDING order
  {
    orderNumber: "ORD-2026-0007",
    customerEmail: "mike.johnson@example.com",
    status: "PENDING",
    paymentStatus: "PENDING",
    shippingAddress: {
      fullName: "Марія Шевченко",
      addressLine1: "вул. Дерибасівська, 8, кв. 12",
      city: "Одеса",
      state: "Одеська обл.",
      postalCode: "65000",
      country: "Україна",
    },
    items: [
      {
        productSku: "MRX-006",
        productName: "Штани Mirox Cargo",
        quantity: 1,
        unitPrice: 1190,
      },
      {
        productSku: "MRX-008",
        productName: "Кепка Mirox",
        quantity: 2,
        unitPrice: 490,
      },
    ],
    createdAt: daysAgo(1),
  },
];
