# Database Schema

PostgreSQL database schema documentation for the Dropshipping E-commerce Platform.

**Last Updated**: 2026-02-10

---

## Overview

The database uses PostgreSQL with Prisma ORM. The schema is defined in `prisma/schema.prisma`.

### Database Connection

```bash
# Connection string format
DATABASE_URL="postgresql://user:password@host:port/database"

# Local development (Docker)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/dropshipping"
```

---

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│   Account   │     │   Session   │
│             │────▶│  (OAuth)    │     │             │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ 1:N                              1:N
       ▼                                   │
┌─────────────┐     ┌─────────────┐     ┌──▼──────────┐
│   Address   │     │    Cart     │────▶│  CartItem   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               │ N:1
                    ┌─────────────┐            ▼
                    │  Category   │◀───┬─────────────┐
                    │ (hierarchy) │    │   Product   │
                    └─────────────┘    └──────┬──────┘
                                              │
                           ┌──────────────────┼──────────────────┐
                           │                  │                  │
                    ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
                    │ProductImage │    │ProductVariant│    │  Supplier   │
                    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                 │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│    Order    │────▶│  OrderItem  │     │SupplierOrder│◀─────────┘
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ├──────────▶┌─────────────┐
       │           │   Review    │◀──── User, Product
       │           └─────────────┘
       │
       └─────────────────────────────────────▲

┌─────────────┐
│ Subscriber  │  (standalone, no FK)
└─────────────┘
```

---

## Tables

### User & Authentication

#### users

Stores user accounts (customers and admins).

| Column        | Type     | Nullable | Default  | Description             |
| ------------- | -------- | -------- | -------- | ----------------------- |
| id            | String   | No       | cuid()   | Primary key             |
| email         | String   | No       | -        | Unique email address    |
| passwordHash  | String   | Yes      | -        | Bcrypt hashed password  |
| name          | String   | Yes      | -        | Display name            |
| role          | Role     | No       | CUSTOMER | User role enum          |
| emailVerified | DateTime | Yes      | -        | Email verification date |
| image         | String   | Yes      | -        | Profile image URL       |
| createdAt     | DateTime | No       | now()    | Creation timestamp      |
| updatedAt     | DateTime | No       | auto     | Last update timestamp   |

**Indexes**: `email` (unique)

**Relations**:

- Has many: Address, Order, Account, Session, Review
- Has one: Cart

---

#### accounts

OAuth provider accounts (NextAuth.js).

| Column            | Type   | Nullable | Description          |
| ----------------- | ------ | -------- | -------------------- |
| id                | String | No       | Primary key          |
| userId            | String | No       | Foreign key to users |
| type              | String | No       | Account type         |
| provider          | String | No       | OAuth provider       |
| providerAccountId | String | No       | Provider's user ID   |
| refresh_token     | Text   | Yes      | OAuth refresh token  |
| access_token      | Text   | Yes      | OAuth access token   |
| expires_at        | Int    | Yes      | Token expiration     |
| token_type        | String | Yes      | Token type           |
| scope             | String | Yes      | OAuth scope          |
| id_token          | Text   | Yes      | OIDC ID token        |
| session_state     | String | Yes      | Session state        |

**Indexes**: `(provider, providerAccountId)` (unique)

---

#### sessions

User sessions (NextAuth.js).

| Column       | Type     | Nullable | Description          |
| ------------ | -------- | -------- | -------------------- |
| id           | String   | No       | Primary key          |
| sessionToken | String   | No       | Unique session token |
| userId       | String   | No       | Foreign key to users |
| expires      | DateTime | No       | Session expiration   |

**Indexes**: `sessionToken` (unique)

---

#### verification_tokens

NextAuth.js verification tokens for passwordless authentication.

| Column     | Type     | Nullable | Description         |
| ---------- | -------- | -------- | ------------------- |
| identifier | String   | No       | Email or identifier |
| token      | String   | No       | Verification token  |
| expires    | DateTime | No       | Token expiration    |

**Indexes**:

- `token` (unique)
- `(identifier, token)` (unique)

---

### Product Catalog

#### categories

Product categories with hierarchy support.

| Column      | Type     | Nullable | Default | Description           |
| ----------- | -------- | -------- | ------- | --------------------- |
| id          | String   | No       | cuid()  | Primary key           |
| name        | String   | No       | -       | Category name         |
| slug        | String   | No       | -       | URL-friendly slug     |
| description | String   | Yes      | -       | Category description  |
| image       | String   | Yes      | -       | Category image URL    |
| parentId    | String   | Yes      | -       | Parent category ID    |
| isActive    | Boolean  | No       | true    | Active status         |
| sortOrder   | Int      | No       | 0       | Display order         |
| createdAt   | DateTime | No       | now()   | Creation timestamp    |
| updatedAt   | DateTime | No       | auto    | Last update timestamp |

**Indexes**: `slug` (unique)

**Relations**:

- Has many: Product, Category (children)
- Belongs to: Category (parent)

---

#### products

Product catalog items.

| Column        | Type          | Nullable | Default | Description               |
| ------------- | ------------- | -------- | ------- | ------------------------- |
| id            | String        | No       | cuid()  | Primary key               |
| name          | String        | No       | -       | Product name              |
| slug          | String        | No       | -       | URL-friendly slug         |
| description   | Text          | Yes      | -       | Full description          |
| shortDesc     | String        | Yes      | -       | Short description         |
| price         | Decimal(10,2) | No       | -       | Selling price             |
| comparePrice  | Decimal(10,2) | Yes      | -       | Original/compare price    |
| costPrice     | Decimal(10,2) | Yes      | -       | Cost price (internal)     |
| sku           | String        | No       | -       | Stock keeping unit        |
| barcode       | String        | Yes      | -       | Product barcode (GTIN)    |
| brand         | String        | Yes      | -       | Product brand name        |
| mpn           | String        | Yes      | -       | Manufacturer Part Number  |
| stock         | Int           | No       | 0       | Available stock           |
| lowStockAlert | Int           | No       | 5       | Low stock threshold       |
| weight        | Decimal(10,3) | Yes      | -       | Weight in kg              |
| isActive      | Boolean       | No       | true    | Active status             |
| isFeatured    | Boolean       | No       | false   | Featured on homepage      |
| categoryId    | String        | No       | -       | Foreign key to categories |
| supplierId    | String        | Yes      | -       | Foreign key to suppliers  |
| supplierSku   | String        | Yes      | -       | Supplier's SKU            |
| supplierPrice | Decimal(10,2) | Yes      | -       | Supplier's price          |
| supplierUrl   | String        | Yes      | -       | Supplier product URL      |
| metaTitle     | String        | Yes      | -       | SEO meta title            |
| metaDesc      | String        | Yes      | -       | SEO meta description      |
| createdAt     | DateTime      | No       | now()   | Creation timestamp        |
| updatedAt     | DateTime      | No       | auto    | Last update timestamp     |

**Indexes**:

- `slug` (unique)
- `sku` (unique)
- `categoryId`
- `supplierId`
- `(isActive, isFeatured)`

**Relations**:

- Belongs to: Category, Supplier
- Has many: ProductImage, ProductVariant, CartItem, OrderItem, Review

---

#### product_images

Product images with ordering.

| Column    | Type     | Nullable | Default | Description        |
| --------- | -------- | -------- | ------- | ------------------ |
| id        | String   | No       | cuid()  | Primary key        |
| url       | String   | No       | -       | Image URL          |
| alt       | String   | Yes      | -       | Alt text           |
| position  | Int      | No       | 0       | Display order      |
| productId | String   | No       | -       | Foreign key        |
| createdAt | DateTime | No       | now()   | Creation timestamp |

**On Delete**: Cascade (deleted with product)

---

#### product_variants

Product variants (size, color, etc.).

| Column    | Type          | Nullable | Default | Description         |
| --------- | ------------- | -------- | ------- | ------------------- |
| id        | String        | No       | cuid()  | Primary key         |
| name      | String        | No       | -       | Variant type (Size) |
| value     | String        | No       | -       | Variant value (XL)  |
| price     | Decimal(10,2) | Yes      | -       | Price override      |
| stock     | Int           | No       | 0       | Variant stock       |
| sku       | String        | Yes      | -       | Variant SKU         |
| productId | String        | No       | -       | Foreign key         |
| createdAt | DateTime      | No       | now()   | Creation timestamp  |
| updatedAt | DateTime      | No       | auto    | Last update         |

**On Delete**: Cascade (deleted with product)

---

### Suppliers

#### suppliers

Product suppliers for dropshipping.

| Column      | Type     | Nullable | Default | Description          |
| ----------- | -------- | -------- | ------- | -------------------- |
| id          | String   | No       | cuid()  | Primary key          |
| name        | String   | No       | -       | Supplier name        |
| code        | String   | No       | -       | Unique supplier code |
| email       | String   | Yes      | -       | Contact email        |
| phone       | String   | Yes      | -       | Contact phone        |
| website     | String   | Yes      | -       | Website URL          |
| apiEndpoint | String   | Yes      | -       | API base URL         |
| apiKey      | String   | Yes      | -       | API key (encrypted)  |
| apiType     | String   | Yes      | -       | API type identifier  |
| isActive    | Boolean  | No       | true    | Active status        |
| notes       | Text     | Yes      | -       | Internal notes       |
| createdAt   | DateTime | No       | now()   | Creation timestamp   |
| updatedAt   | DateTime | No       | auto    | Last update          |

**Indexes**: `code` (unique)

---

### Shopping Cart

#### carts

User shopping carts.

| Column    | Type     | Nullable | Default | Description          |
| --------- | -------- | -------- | ------- | -------------------- |
| id        | String   | No       | cuid()  | Primary key          |
| userId    | String   | No       | -       | Foreign key to users |
| createdAt | DateTime | No       | now()   | Creation timestamp   |
| updatedAt | DateTime | No       | auto    | Last update          |

**Indexes**: `userId` (unique)

---

#### cart_items

Items in shopping carts.

| Column    | Type     | Nullable | Default | Description          |
| --------- | -------- | -------- | ------- | -------------------- |
| id        | String   | No       | cuid()  | Primary key          |
| cartId    | String   | No       | -       | Foreign key to carts |
| productId | String   | No       | -       | Foreign key          |
| variantId | String   | Yes      | -       | Foreign key          |
| quantity  | Int      | No       | -       | Item quantity        |
| createdAt | DateTime | No       | now()   | Creation timestamp   |
| updatedAt | DateTime | No       | auto    | Last update          |

**Indexes**: `(cartId, productId, variantId)` (unique)

---

### Orders

#### orders

Customer orders.

| Column          | Type          | Nullable | Default | Description            |
| --------------- | ------------- | -------- | ------- | ---------------------- |
| id              | String        | No       | cuid()  | Primary key            |
| orderNumber     | String        | No       | -       | Human-readable number  |
| userId          | String        | Yes      | -       | Foreign key (optional) |
| email           | String        | No       | -       | Customer email         |
| phone           | String        | Yes      | -       | Customer phone         |
| status          | OrderStatus   | No       | PENDING | Order status enum      |
| subtotal        | Decimal(10,2) | No       | -       | Items subtotal         |
| shippingCost    | Decimal(10,2) | No       | -       | Shipping cost          |
| discount        | Decimal(10,2) | No       | 0       | Discount amount        |
| tax             | Decimal(10,2) | No       | -       | Tax amount             |
| total           | Decimal(10,2) | No       | -       | Order total            |
| currency        | String        | No       | USD     | Currency code          |
| shippingAddress | Json          | No       | -       | Shipping address       |
| billingAddress  | Json          | Yes      | -       | Billing address        |
| shippingMethod  | String        | Yes      | -       | Selected shipping      |
| paymentMethod   | String        | Yes      | -       | Payment method         |
| paymentIntent   | String        | Yes      | -       | Stripe PaymentIntent   |
| paymentStatus   | PaymentStatus | No       | PENDING | Payment status enum    |
| paidAt          | DateTime      | Yes      | -       | Payment timestamp      |
| trackingNumber  | String        | Yes      | -       | Shipping tracking      |
| trackingUrl     | String        | Yes      | -       | Tracking URL           |
| notes           | Text          | Yes      | -       | Internal notes         |
| customerNotes   | Text          | Yes      | -       | Customer notes         |
| createdAt       | DateTime      | No       | now()   | Creation timestamp     |
| updatedAt       | DateTime      | No       | auto    | Last update            |

**Indexes**:

- `orderNumber` (unique)
- `userId`
- `status`
- `paymentStatus`
- `createdAt`

---

#### order_items

Line items in orders.

| Column      | Type          | Nullable | Description        |
| ----------- | ------------- | -------- | ------------------ |
| id          | String        | No       | Primary key        |
| orderId     | String        | No       | Foreign key        |
| productId   | String        | No       | Foreign key        |
| variantId   | String        | Yes      | Foreign key        |
| productName | String        | No       | Snapshot of name   |
| productSku  | String        | No       | Snapshot of SKU    |
| variantInfo | String        | Yes      | Variant details    |
| quantity    | Int           | No       | Quantity ordered   |
| unitPrice   | Decimal(10,2) | No       | Price per unit     |
| totalPrice  | Decimal(10,2) | No       | Line total         |
| createdAt   | DateTime      | No       | Creation timestamp |

**Note**: Product name and SKU are snapshotted to preserve order history.

---

#### supplier_orders

Orders forwarded to suppliers.

| Column          | Type          | Nullable | Description           |
| --------------- | ------------- | -------- | --------------------- |
| id              | String        | No       | Primary key           |
| orderId         | String        | No       | Foreign key to orders |
| supplierId      | String        | No       | Foreign key           |
| supplierOrderId | String        | Yes      | Supplier's order ID   |
| status          | String        | No       | Forwarding status     |
| trackingNumber  | String        | Yes      | Supplier tracking     |
| trackingUrl     | String        | Yes      | Tracking URL          |
| cost            | Decimal(10,2) | Yes      | Supplier cost         |
| notes           | Text          | Yes      | Notes                 |
| errorMessage    | Text          | Yes      | Error if failed       |
| sentAt          | DateTime      | Yes      | When sent to supplier |
| createdAt       | DateTime      | No       | Creation timestamp    |
| updatedAt       | DateTime      | No       | Last update           |

---

### Customer Data

#### addresses

Saved customer addresses.

| Column     | Type     | Nullable | Default | Description        |
| ---------- | -------- | -------- | ------- | ------------------ |
| id         | String   | No       | cuid()  | Primary key        |
| userId     | String   | No       | -       | Foreign key        |
| name       | String   | No       | -       | Recipient name     |
| company    | String   | Yes      | -       | Company name       |
| line1      | String   | No       | -       | Address line 1     |
| line2      | String   | Yes      | -       | Address line 2     |
| city       | String   | No       | -       | City               |
| state      | String   | Yes      | -       | State/Province     |
| postalCode | String   | No       | -       | ZIP/Postal code    |
| country    | String   | No       | -       | Country code       |
| phone      | String   | Yes      | -       | Phone number       |
| isDefault  | Boolean  | No       | false   | Default address    |
| createdAt  | DateTime | No       | now()   | Creation timestamp |
| updatedAt  | DateTime | No       | auto    | Last update        |

---

### Reviews

#### reviews

Customer product reviews with admin moderation.

| Column         | Type     | Nullable | Default | Description                 |
| -------------- | -------- | -------- | ------- | --------------------------- |
| id             | String   | No       | cuid()  | Primary key                 |
| productId      | String   | No       | -       | Foreign key to products     |
| userId         | String   | No       | -       | Foreign key to users        |
| orderId        | String   | No       | -       | Foreign key to orders       |
| rating         | Int      | No       | -       | Rating (1-5 stars)          |
| comment        | Text     | Yes      | -       | Review text (max 2000)      |
| isHidden       | Boolean  | No       | false   | Hidden by admin             |
| adminReply     | String   | Yes      | -       | Admin reply text (max 1000) |
| adminRepliedAt | DateTime | Yes      | -       | When admin replied          |
| createdAt      | DateTime | No       | now()   | Creation timestamp          |
| updatedAt      | DateTime | No       | auto    | Last update timestamp       |

**Indexes**:

- `(userId, productId)` (unique — one review per product per user)
- `productId`
- `userId`
- `orderId`
- `isHidden`
- `createdAt`

**On Delete**: Cascade (deleted when user, product, or order is deleted)

**Relations**:

- Belongs to: Product, User, Order

---

### Newsletter

#### subscribers

Newsletter email subscribers with double opt-in.

| Column             | Type             | Nullable | Default | Description           |
| ------------------ | ---------------- | -------- | ------- | --------------------- |
| id                 | String           | No       | cuid()  | Primary key           |
| email              | String           | No       | -       | Unique email address  |
| status             | SubscriberStatus | No       | PENDING | Subscription status   |
| confirmationToken  | String           | Yes      | -       | Double opt-in token   |
| confirmationExpiry | DateTime         | Yes      | -       | Token expiration      |
| subscribedAt       | DateTime         | Yes      | -       | When confirmed/active |
| unsubscribedAt     | DateTime         | Yes      | -       | When unsubscribed     |
| createdAt          | DateTime         | No       | now()   | Creation timestamp    |
| updatedAt          | DateTime         | No       | auto    | Last update timestamp |

**Indexes**:

- `email` (unique)
- `confirmationToken` (unique)
- `status`
- `createdAt`

**Relations**: Standalone (no foreign keys)

---

### Configuration

#### settings

Key-value store for application settings.

| Column    | Type     | Nullable | Default | Description        |
| --------- | -------- | -------- | ------- | ------------------ |
| id        | String   | No       | cuid()  | Primary key        |
| key       | String   | No       | -       | Setting key        |
| value     | Text     | No       | -       | Setting value      |
| type      | String   | No       | string  | Value type         |
| createdAt | DateTime | No       | now()   | Creation timestamp |
| updatedAt | DateTime | No       | auto    | Last update        |

**Indexes**: `key` (unique)

---

## Enums

### Role

User roles for authorization.

| Value    | Description      |
| -------- | ---------------- |
| CUSTOMER | Regular customer |
| ADMIN    | Administrator    |

### OrderStatus

Order lifecycle status.

| Value      | Description                  |
| ---------- | ---------------------------- |
| PENDING    | Order created, not confirmed |
| CONFIRMED  | Order confirmed              |
| PROCESSING | Being processed              |
| SHIPPED    | Shipped to customer          |
| DELIVERED  | Delivered                    |
| CANCELLED  | Cancelled                    |
| REFUNDED   | Refunded                     |

### PaymentStatus

Payment status.

| Value              | Description        |
| ------------------ | ------------------ |
| PENDING            | Awaiting payment   |
| PAID               | Payment received   |
| FAILED             | Payment failed     |
| REFUNDED           | Fully refunded     |
| PARTIALLY_REFUNDED | Partially refunded |

### SubscriberStatus

Newsletter subscription status.

| Value        | Description                     |
| ------------ | ------------------------------- |
| PENDING      | Awaiting email confirmation     |
| ACTIVE       | Confirmed and active subscriber |
| UNSUBSCRIBED | User has unsubscribed           |

---

## Common Commands

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Seed database
npx prisma db seed
```

---

## Seed Data

The seed script (`prisma/seed.ts`) orchestrates modular seed files from `prisma/seed-data/`:

| Module      | File                       | Data                                          |
| ----------- | -------------------------- | --------------------------------------------- |
| Users       | `seed-data/users.ts`       | 1 admin + 4 test customers                    |
| Categories  | `seed-data/categories.ts`  | 16 categories (top-level + subcategories)     |
| Products    | `seed-data/products.ts`    | 50+ products with images, brand, MPN, barcode |
| Orders      | `seed-data/orders.ts`      | 6+ orders with various statuses               |
| Reviews     | `seed-data/reviews.ts`     | 8 reviews with admin replies                  |
| Subscribers | `seed-data/subscribers.ts` | 6 newsletter subscribers (various statuses)   |

Seed uses upsert operations for idempotent execution and maintains entity relationships via Map<string, string> for foreign keys.

```bash
# Run seed
npx prisma db seed

# Test accounts (passwords come from SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD,
# generated and printed when unset locally — never committed):
# Admin: admin@store.com
# Customers: customer@example.com, sarah.wilson@example.com,
#            mike.johnson@example.com, emily.chen@example.com
```

---

_See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design._
_See [prisma/schema.prisma](../../prisma/schema.prisma) for source schema._
