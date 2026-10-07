// Newsletter subscriber seed data with various statuses

export interface SubscriberSeedData {
  email: string;
  status: string;
  createdAt: Date;
  subscribedAt?: Date;
  unsubscribedAt?: Date;
  confirmationToken?: string;
  confirmationExpiry?: Date;
}

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

export const subscribers: SubscriberSeedData[] = [
  // ACTIVE subscribers (confirmed)
  {
    email: "newsletter.fan@example.com",
    status: "ACTIVE",
    subscribedAt: daysAgo(60),
    createdAt: daysAgo(60),
  },
  {
    email: "deals.hunter@example.com",
    status: "ACTIVE",
    subscribedAt: daysAgo(45),
    createdAt: daysAgo(45),
  },
  {
    email: "shop.lover@example.com",
    status: "ACTIVE",
    subscribedAt: daysAgo(30),
    createdAt: daysAgo(30),
  },
  {
    email: "promo.seeker@example.com",
    status: "ACTIVE",
    subscribedAt: daysAgo(14),
    createdAt: daysAgo(14),
  },
  // PENDING subscriber (awaiting confirmation)
  {
    email: "new.signup@example.com",
    status: "PENDING",
    confirmationToken: "demo-confirmation-token-abc123",
    confirmationExpiry: hoursFromNow(24),
    createdAt: daysAgo(1),
  },
  // UNSUBSCRIBED subscriber
  {
    email: "former.subscriber@example.com",
    status: "UNSUBSCRIBED",
    subscribedAt: daysAgo(90),
    unsubscribedAt: daysAgo(15),
    createdAt: daysAgo(90),
  },
];
