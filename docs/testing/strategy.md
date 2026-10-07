# Testing Strategy

Testing approach and guidelines for the Dropshipping E-commerce Platform.

**Last Updated**: 2026-10-02

---

## Overview

The project uses a multi-layered testing approach:

| Layer  | Framework  | Purpose                       | Location                  |
| ------ | ---------- | ----------------------------- | ------------------------- |
| Unit   | Vitest     | Services, utilities, stores   | tests/unit/               |
| E2E    | Playwright | User flows, page interactions | tests/e2e/                |
| Manual | Checklist  | Visual, edge cases            | docs/TESTING_CHECKLIST.md |

---

## Unit Testing

### Configuration

Unit tests are configured with Vitest in `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.tsx"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

### Running Tests

```bash
# Run all unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── setup.tsx                          # Global setup (mocks for Next.js router, image)
├── global-setup.ts                    # E2E infrastructure validation
├── helpers/
│   └── api-test-utils.ts             # NextRequest/params builders for API route testing
├── unit/
│   ├── cart.store.test.ts            # Cart store tests
│   ├── seo.test.ts                   # SEO utilities tests (metadata, JSON-LD)
│   ├── api-utils.test.ts            # API helpers (auth guards, response helpers, pagination)
│   ├── slug.test.ts                 # Slug generator (KMU-55 transliteration, G24)
│   ├── newsletter.test.ts           # Newsletter utilities (token, URL builders, HMAC)
│   ├── newsletter-api.test.ts       # Public newsletter API (subscribe, confirm, unsubscribe)
│   ├── admin-newsletter-api.test.ts # Admin newsletter API (list, update, delete, export)
│   ├── reviews-api.test.ts          # Customer review API (create, update, delete, eligibility)
│   ├── admin-reviews-api.test.ts    # Admin review API (list, detail, delete, reply, visibility)
│   └── google-shopping-feed.test.ts # Google Shopping feed validation
└── e2e/
    ├── navigation.spec.ts           # Homepage, navigation, mobile responsive
    ├── products.spec.ts             # Product listing and detail pages
    └── cart.spec.ts                 # Cart operations
```

### Writing Unit Tests

#### Store Testing

```typescript
// tests/unit/cart.store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/stores/cart.store";

describe("Cart Store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useCartStore.setState({ items: [], isOpen: false });
  });

  it("should add item to cart", () => {
    const { addItem, items } = useCartStore.getState();

    addItem({
      id: "product-1",
      name: "Test Product",
      price: "29.99",
      quantity: 1,
    });

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].name).toBe("Test Product");
  });

  it("should calculate total correctly", () => {
    const { addItem, total } = useCartStore.getState();

    addItem({ id: "1", name: "A", price: "10.00", quantity: 2 });
    addItem({ id: "2", name: "B", price: "5.50", quantity: 1 });

    expect(useCartStore.getState().total()).toBe(25.5);
  });
});
```

#### Utility Testing

```typescript
// tests/unit/seo.test.ts
import { describe, it, expect } from "vitest";
import { getProductMetadata, getProductJsonLd } from "@/lib/seo";

describe("SEO Utilities", () => {
  const mockProduct = {
    name: "Test Product",
    slug: "test-product",
    description: "A great product",
    price: "29.99",
    images: [{ url: "https://example.com/image.jpg" }],
    stock: 10,
    category: { name: "Category", slug: "category" },
  };

  describe("getProductMetadata", () => {
    it("should generate correct title", () => {
      const metadata = getProductMetadata(mockProduct);
      expect(metadata.title).toContain("Test Product");
    });

    it("should include OpenGraph data", () => {
      const metadata = getProductMetadata(mockProduct);
      expect(metadata.openGraph?.images).toBeDefined();
    });
  });

  describe("getProductJsonLd", () => {
    it("should generate valid schema", () => {
      const jsonLd = getProductJsonLd(mockProduct);
      expect(jsonLd["@type"]).toBe("Product");
      expect(jsonLd.name).toBe("Test Product");
    });
  });
});
```

### Test Coverage

Coverage baseline (as of TASK-028, 249 tests):

| Metric     | Coverage |
| ---------- | -------- |
| Statements | 89.82%   |
| Branches   | 93.19%   |
| Functions  | 98.71%   |
| Lines      | 89.82%   |

| Area             | Target | Current |
| ---------------- | ------ | ------- |
| Stores           | 80%    | 100%    |
| Utilities (lib/) | 80%    | ~90%    |
| API routes       | 70%    | ~85%    |
| Overall          | 70%    | 89.82%  |

---

## E2E Testing

### Configuration

E2E tests are configured with Playwright in `playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 12"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test navigation.spec.ts

# Run in specific browser
npx playwright test --project=chromium
```

### Test Structure

```
tests/e2e/
├── navigation.spec.ts    # Homepage, navigation, mobile responsive
├── products.spec.ts      # Product listing and detail pages
└── cart.spec.ts          # Cart operations and persistence
```

**E2E Infrastructure**: Global setup (`tests/global-setup.ts`) validates database connectivity and seed data before tests run. CI uses pre-built app with PostgreSQL 16 + Redis 7 services.

### Writing E2E Tests

#### Page Navigation

```typescript
// tests/e2e/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("should display hero section", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Welcome");
    await expect(page.getByRole("link", { name: /shop now/i })).toBeVisible();
  });

  test("should navigate to products", async ({ page }) => {
    await page.goto("/");

    await page.click("text=Shop Now");

    await expect(page).toHaveURL(/\/products/);
  });
});
```

#### Product Interactions

```typescript
// tests/e2e/products.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Product Listing", () => {
  test("should display products", async ({ page }) => {
    await page.goto("/products");

    // Wait for products to load
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test("should filter by category", async ({ page }) => {
    await page.goto("/products");

    await page.selectOption('[data-testid="category-filter"]', "electronics");

    await expect(page).toHaveURL(/category=electronics/);
  });

  test("should search products", async ({ page }) => {
    await page.goto("/products");

    await page.fill('[data-testid="search-input"]', "laptop");
    await page.press('[data-testid="search-input"]', "Enter");

    await expect(page).toHaveURL(/search=laptop/);
  });
});
```

#### Cart Operations

```typescript
// tests/e2e/cart.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Shopping Cart", () => {
  test("should add product to cart", async ({ page }) => {
    await page.goto("/products/sample-product");

    await page.click("text=Add to Cart");

    // Cart drawer should open
    await expect(page.locator('[data-testid="cart-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-count"]')).toContainText("1");
  });

  test("should update quantity", async ({ page }) => {
    // First add item
    await page.goto("/products/sample-product");
    await page.click("text=Add to Cart");

    // Go to cart
    await page.goto("/cart");

    // Increase quantity
    await page.click('[data-testid="quantity-increase"]');

    await expect(page.locator('[data-testid="quantity-input"]')).toHaveValue("2");
  });

  test("should persist cart across pages", async ({ page }) => {
    await page.goto("/products/sample-product");
    await page.click("text=Add to Cart");

    // Navigate away
    await page.goto("/");

    // Cart should still have item
    await expect(page.locator('[data-testid="cart-count"]')).toContainText("1");
  });
});
```

### E2E Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Wait for elements** before interacting
3. **Test user flows**, not implementation details
4. **Keep tests independent** - don't rely on order
5. **Use fixtures** for common setup
6. **Run against production build** for reliability

### CI/CD Considerations

For reliable E2E tests in CI:

```yaml
# GitHub Actions example
- name: Build application
  run: npm run build

- name: Start server
  run: npm run start &
  env:
    PORT: 3001

- name: Wait for server
  run: npx wait-on http://localhost:3001

- name: Run E2E tests
  run: npx playwright test
```

---

## Manual Testing

See [docs/TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) for comprehensive manual testing checklist.

### When to Manual Test

- Before releases
- After major feature changes
- Cross-browser compatibility
- Visual design verification
- Accessibility testing
- Edge cases not covered by automation

### Key Manual Test Areas

- [ ] Homepage renders correctly
- [ ] Product images load
- [ ] Cart operations work
- [ ] Checkout flow completes
- [ ] Admin functions work
- [ ] Mobile responsive design
- [ ] Payment flow (Stripe test cards)

---

## Testing Data

### Test Database

```bash
# Reset and seed test data
npx prisma migrate reset

# Seed only (no reset)
npx prisma db seed
```

### Stripe Test Cards

| Scenario      | Card Number         | CVC | Expiry |
| ------------- | ------------------- | --- | ------ |
| Success       | 4242 4242 4242 4242 | Any | Future |
| Decline       | 4000 0000 0000 0002 | Any | Future |
| Requires Auth | 4000 0025 0000 3155 | Any | Future |
| Invalid CVC   | 4000 0000 0000 0127 | Any | Future |

---

## Continuous Integration

### Test Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run test:coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
```

---

## Test Utilities

### Common Mocks

```typescript
// tests/setup.tsx
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock Next.js image
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));
```

### Custom Test Utilities

```typescript
// tests/utils.ts
import { render } from '@testing-library/react';

// Custom render with providers
export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <Providers>
      {ui}
    </Providers>
  );
}
```

---

## Coverage Reports

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage in CI

Coverage reports are generated in CI and can be:

- Uploaded to Codecov
- Published as artifacts
- Displayed in PR comments

---

_See [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) for manual testing._
_See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design._
