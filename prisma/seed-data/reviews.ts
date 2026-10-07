// Review seed data - only for DELIVERED orders

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

export const reviews = [
  // Reviews for order ORD-2026-0001 (Олександр Петренко - hoodie, olimpiyka)
  {
    customerEmail: "customer@example.com",
    productSku: "MRX-001",
    orderNumber: "ORD-2026-0001",
    rating: 5,
    comment: "Відмінна якість! Худі сидить ідеально, тканина щільна, дуже задоволений покупкою.",
    adminReply: "Дякуємо за відгук! Раді, що худі підійшло — носіть із задоволенням!",
    adminRepliedAt: daysAgo(1),
    createdAt: daysAgo(2),
  },
  {
    customerEmail: "customer@example.com",
    productSku: "MRX-003",
    orderNumber: "ORD-2026-0001",
    rating: 4,
    comment:
      "Олімпійка приємна на дотик, начос теплий. Розмір відповідає таблиці, але рукави трохи довші, ніж очікував.",
    createdAt: daysAgo(6),
  },

  // Reviews for order ORD-2026-0002 (Дмитро Коваленко - t-shirt, white hoodie)
  {
    customerEmail: "sarah.wilson@example.com",
    productSku: "MRX-002",
    orderNumber: "ORD-2026-0002",
    rating: 5,
    comment: "Швидка доставка, все як на фото. Рекомендую!",
    createdAt: daysAgo(4),
  },
  {
    customerEmail: "sarah.wilson@example.com",
    productSku: "MRX-004",
    orderNumber: "ORD-2026-0002",
    rating: 5,
    comment:
      "Біле худі виглядає ще краще наживо. Тканина щільна, не просвічує, шви акуратні. Обов'язково візьму ще один колір.",
    createdAt: daysAgo(8),
  },

  // Reviews for order ORD-2026-0003 (Марія Шевченко - oversize hoodie, longsleeve)
  {
    customerEmail: "mike.johnson@example.com",
    productSku: "MRX-005",
    orderNumber: "ORD-2026-0003",
    rating: 5,
    comment:
      "Оверсайз худі — саме те, що шукала! Сидить вільно, але не мішкувато, дуже приємний матеріал. Ношу постійно.",
    adminReply: "Дякуємо, Маріє! Раді, що оверсайз-крій припав до смаку. Гарного носіння!",
    adminRepliedAt: daysAgo(9),
    createdAt: daysAgo(10),
  },
  {
    customerEmail: "mike.johnson@example.com",
    productSku: "MRX-007",
    orderNumber: "ORD-2026-0003",
    rating: 3,
    comment:
      "Лонгслів непоганий, але тканина тонша, ніж я очікувала за цю ціну. Розмір підійшов, колір відповідає фото.",
    createdAt: daysAgo(11),
  },

  // Reviews for order ORD-2026-0004 (Ірина Бондаренко - olimpiyka, white hoodie)
  {
    customerEmail: "emily.chen@example.com",
    productSku: "MRX-003",
    orderNumber: "ORD-2026-0004",
    rating: 4,
    comment:
      "Гарна олімпійка на весну-осінь, зручні кишені. Блискавка трохи туга, та загалом задоволена покупкою.",
    createdAt: daysAgo(13),
  },
  {
    customerEmail: "emily.chen@example.com",
    productSku: "MRX-004",
    orderNumber: "ORD-2026-0004",
    rating: 4,
    comment:
      "Худі якісне, тканина не просвічує навіть у білому кольорі. Розмір М трохи більший, ніж очікувала, але це навіть плюс для оверсайз-стилю.",
    createdAt: daysAgo(14),
  },
];
