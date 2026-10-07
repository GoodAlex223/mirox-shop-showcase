import { screen } from "@testing-library/react";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { useTranslations } from "next-intl";
import { createElement } from "react";
import { renderWithIntl } from "../helpers/render-with-intl";
import uk from "../../messages/uk.json";
import ru from "../../messages/ru.json";

type Tree = { [k: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)
  );
}

/**
 * Render probe for the brief's Step 4 fallback: `createTranslator` is NOT
 * actually exported from "next-intl" in the installed v4.13.6 — confirmed by
 * grepping node_modules/next-intl/dist for the symbol, which only turns up
 * inside the server-only, react-server-conditioned internals (unreachable
 * from Vitest, which resolves next-intl's client build regardless of
 * "use client"/async status — Vitest has no concept of the React Server
 * Components module graph Next's own bundler builds). So every assertion
 * below that needs a REAL next-intl render (not just a plain JSON value
 * read) goes through `NextIntlClientProvider` via `renderWithIntl` and this
 * probe component instead. The assertion this guards — rendered output
 * equals the verbatim string — is unchanged from the brief's stated intent.
 */
function Probe({
  namespace,
  msgKey,
  values,
}: {
  namespace: string;
  msgKey: string;
  values?: Record<string, string | number>;
}) {
  const t = useTranslations(namespace);
  return createElement("span", null, t(msgKey, values));
}

/** Exercises the t.has guarded-dynamic-key mechanism (Task 5's six byCode
 * spots) against the real catalog — not just presence of the JSON key. */
function HasProbe({ namespace, msgKey }: { namespace: string; msgKey: string }) {
  const t = useTranslations(namespace);
  return createElement("span", null, String(t.has(msgKey as never)));
}

describe("message catalogs", () => {
  it("ru contains no orphan keys (every ru key path exists in uk — uk is the schema)", () => {
    const ukKeys = new Set(leaves(uk as Tree).map(([k]) => k));
    const orphans = leaves(ru as Tree)
      .map(([k]) => k)
      .filter((k) => !ukKeys.has(k));
    expect(orphans).toEqual([]);
  });

  it("ru covers every uk key (full draft — Task 9 flips this to hard)", () => {
    const ruKeys = new Set(leaves(ru as Tree).map(([k]) => k));
    // admin.* is UA-only by decision (G13, 2026-08-16): RU deep-merge falls back to UA.
    // pages.* is UA-only by the same decision (G23): the seven info/legal pages
    // get no ru.json keys.
    const missing = leaves(uk as Tree)
      .map(([k]) => k)
      .filter((k) => !k.startsWith("admin.") && !k.startsWith("pages."))
      .filter((k) => !ruKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("has no admin namespace in ru — admin is UA-only by G13 decision", () => {
    expect("admin" in ru).toBe(false);
  });

  it("ru reuses every ICU argument its uk counterpart declares", () => {
    const args = (s: string) => [...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
    const ruMap = new Map(leaves(ru as Tree));
    for (const [key, ukVal] of leaves(uk as Tree)) {
      const ruVal = ruMap.get(key);
      if (ruVal) expect(args(ruVal), key).toEqual(args(ukVal));
    }
  });

  it("never advertises retracted services in any locale (G8/site.ts retraction rulings)", () => {
    const all = [...leaves(uk as Tree), ...leaves(ru as Tree)]
      .map(([, v]) => v)
      .join(" ")
      .toLowerCase();
    expect(all).not.toMatch(
      /обмін розміру|обмен размера|безкоштовна доставка|бесплатная доставка|free delivery|size exchange/
    );
  });

  it("renders apostrophe-bearing UA copy through ICU unchanged", () => {
    renderWithIntl(createElement(Probe, { namespace: "site", msgKey: "announcement.linkLabel" }));
    expect(screen.getByText("Розкажіть нам через форму зворотного зв'язку")).toBeInTheDocument();
  });

  // Controller-added (closes a deferral noted in Task 3's report): the 11-14
  // teen exception must land on "many", not "few" — a naive "ends in 1 → one"
  // or "ends in 2-4 → few" implementation would mis-render 11 specifically.
  it("hits the ICU many-branch for the 11-14 teen exception (cart.itemsCount, count=11)", () => {
    renderWithIntl(
      createElement(Probe, { namespace: "cart", msgKey: "itemsCount", values: { count: 11 } })
    );
    expect(screen.getByText("11 товарів")).toBeInTheDocument();
  });

  it("wraps the slogan into exactly two lines (brief's three-line split was not used)", () => {
    expect(uk.home.hero.headline1).toBe("СТИЛЬ. ЯКІСТЬ.");
    expect(uk.home.hero.headline2).toBe("ВПЕВНЕНІСТЬ.");
  });

  it("provides the six always-true why-choose-us claims, plus a non-empty intro", () => {
    expect(Object.keys(uk.home.whyChooseUs.items)).toHaveLength(6);
    expect(uk.home.whyChooseUs.intro.length).toBeGreaterThan(0);
  });

  // Supersedes content.test.ts's former "site header content" describe block
  // (site.header.search.viewAll/noResults no longer exist on the trimmed
  // content module — the functions moved to ICU {query} templates here).
  it("wraps search queries in Ukrainian guillemets with the query interpolated", () => {
    renderWithIntl(
      createElement(Probe, {
        namespace: "header",
        msgKey: "search.viewAll",
        values: { query: "test" },
      })
    );
    expect(screen.getByText("Всі результати для «test»")).toBeInTheDocument();

    renderWithIntl(
      createElement(Probe, {
        namespace: "header",
        msgKey: "search.noResults",
        values: { query: "test" },
      })
    );
    expect(screen.getByText("Нічого не знайдено за запитом «test»")).toBeInTheDocument();
  });

  // Task 5 moved-string-assertions: the underlying content modules that used
  // to carry these values (auth.ts/system.ts) are deleted; the strings now
  // live only in the catalog, so the assertions move here verbatim.
  it("keeps auth submit CTAs uppercase per the shipped checkout convention", () => {
    expect(uk.auth.login.submit).toBe(uk.auth.login.submit.toUpperCase());
    expect(uk.auth.register.submit).toBe(uk.auth.register.submit.toUpperCase());
  });

  it("has the cookie banner button pair", () => {
    expect(uk.system.cookies.accept).toBe("Прийняти");
    expect(uk.system.cookies.decline).toBe("Відхилити");
  });

  it("provides the account order-detail payment method labels (methodLabel ternary moved to the component, values stay here)", () => {
    expect(uk.account.orderDetail.payment.methodCod).toBe("Оплата при отриманні");
    expect(uk.account.orderDetail.payment.methodCard).toBe("Карткою");
  });

  it("renders the account orders 'more items' ICU plural across one/few/many, exactly (brief-mandated +2 case included)", () => {
    renderWithIntl(
      createElement(Probe, {
        namespace: "account",
        msgKey: "orders.card.more",
        values: { count: 1 },
      })
    );
    expect(screen.getByText("+1 інший товар")).toBeInTheDocument();

    renderWithIntl(
      createElement(Probe, {
        namespace: "account",
        msgKey: "orders.card.more",
        values: { count: 2 },
      })
    );
    expect(screen.getByText("+2 інші товари")).toBeInTheDocument();

    renderWithIntl(
      createElement(Probe, {
        namespace: "account",
        msgKey: "orders.card.more",
        values: { count: 5 },
      })
    );
    expect(screen.getByText("+5 інших товарів")).toBeInTheDocument();
  });

  it("interpolates the unsubscribe prompt email exactly", () => {
    renderWithIntl(
      createElement(Probe, {
        namespace: "newsletter.unsubscribe",
        msgKey: "idle.prompt",
        values: { email: "a@b.ua" },
      })
    );
    expect(
      screen.getByText("Ви впевнені, що хочете відписати a@b.ua від нашої розсилки?")
    ).toBeInTheDocument();
  });
});

describe("byCode coverage (replaces content.test.ts's byCode blocks 1:1 — TASK-039 Task 5)", () => {
  it("newsletter.confirm covers every code /api/newsletter/confirm emits", () => {
    const byCode = uk.newsletter.confirm.byCode as Record<
      string,
      { title: string; description: string }
    >;
    for (const code of [
      "CONFIRMED",
      "ALREADY_CONFIRMED",
      "LINK_EXPIRED",
      "INVALID_TOKEN",
      "TOKEN_REQUIRED",
    ]) {
      expect(byCode[code]?.title).toBeTruthy();
      expect(byCode[code]?.description).toBeTruthy();
    }
  });

  it("newsletter.unsubscribe covers every code /api/newsletter/unsubscribe emits", () => {
    const byCode = uk.newsletter.unsubscribe.byCode as Record<
      string,
      { title: string; description: string }
    >;
    for (const code of [
      "UNSUBSCRIBED",
      "ALREADY_UNSUBSCRIBED",
      "SUBSCRIBER_NOT_FOUND",
      "INVALID_UNSUBSCRIBE_LINK",
      "VALIDATION_ERROR",
    ]) {
      expect(byCode[code]?.title).toBeTruthy();
      expect(byCode[code]?.description).toBeTruthy();
    }
  });

  it("newsletter.signup covers the ALREADY_SUBSCRIBED code /api/newsletter/subscribe emits", () => {
    const byCode = uk.newsletter.signup.byCode as Record<string, string>;
    expect(byCode.ALREADY_SUBSCRIBED).toBeTruthy();
  });

  it("auth.register covers the EMAIL_EXISTS code /api/auth/register emits", () => {
    const byCode = uk.auth.register.errors.byCode as Record<string, string>;
    expect(byCode.EMAIL_EXISTS).toBeTruthy();
  });

  it("feedback covers every code /api/feedback emits", () => {
    const byCode = uk.feedback.byCode as Record<string, string>;
    for (const code of ["VALIDATION_ERROR", "SEND_FAILED"]) {
      expect(byCode[code]).toBeTruthy();
    }
  });

  it("checkout.errors covers every code /api/checkout/create-order emits", () => {
    const errors = uk.checkout.errors as Record<string, string>;
    for (const code of [
      "PRODUCT_UNAVAILABLE",
      "INVALID_VARIANT",
      "INVALID_SHIPPING_METHOD",
      "INVALID_ORDER_DATA",
    ]) {
      expect(errors[code]).toBeTruthy();
    }
  });

  // Guarded-lookup mechanism check (not just catalog presence): confirms
  // t.has() — the mechanism all six byCode consumer spots use — actually
  // resolves true for a real code and false for an absent one, against the
  // live catalog through a real NextIntlClientProvider render.
  it("t.has resolves true for a real byCode key", () => {
    renderWithIntl(
      createElement(HasProbe, { namespace: "checkout", msgKey: "errors.PRODUCT_UNAVAILABLE" })
    );
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("t.has resolves false for a code with no catalog entry", () => {
    renderWithIntl(
      createElement(HasProbe, { namespace: "checkout", msgKey: "errors.TOTALLY_UNKNOWN_CODE" })
    );
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("t.has resolves the object-shaped byCode entries at the .title leaf, not the parent path (newsletter confirm/unsubscribe pattern)", () => {
    renderWithIntl(
      createElement(HasProbe, { namespace: "newsletter.confirm", msgKey: "byCode.CONFIRMED.title" })
    );
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("track.byCode covers every code /api/orders/lookup emits", () => {
    const byCode = uk.track.byCode as Record<string, string>;
    for (const code of [
      "ORDER_NOT_FOUND",
      "TOO_MANY_ATTEMPTS",
      "VALIDATION_ERROR",
      "LOOKUP_FAILED",
    ]) {
      expect(byCode[code]).toBeTruthy();
    }
    expect(uk.track.fallback).toBeTruthy();
  });

  it("renders the lockout copy with the minutes argument in both locales", () => {
    renderWithIntl(
      createElement(Probe, {
        namespace: "track",
        msgKey: "byCode.TOO_MANY_ATTEMPTS",
        values: { minutes: 15 },
      })
    );
    expect(screen.getByText("Забагато спроб. Спробуйте знову через 15 хв.")).toBeInTheDocument();
    expect((ru.track.byCode as Record<string, string>).TOO_MANY_ATTEMPTS).toContain("{minutes}");
  });
});

describe("Prisma enum → account status label coverage", () => {
  // The account pages render t(`orderStatus.${status}`) / t(`paymentStatus.${status}`)
  // with a raw-status runtime fallback; this block is the drift net that fails
  // BEFORE a new Prisma enum value ships unlabeled. (Sole net since PR #37
  // review round 2 deleted src/content/account.ts and its map-coverage tests —
  // the maps had no production consumers; admin now sources labels from the
  // catalog since G13, reusing these same account.orderStatus/paymentStatus
  // keys.)
  const orderStatusLabels = uk.account.orderStatus as Record<string, string>;
  const paymentStatusLabels = uk.account.paymentStatus as Record<string, string>;

  it("labels every OrderStatus value in uk.json", () => {
    const values = Object.values(OrderStatus);
    expect(values.length).toBeGreaterThan(0);
    for (const s of values) {
      expect(orderStatusLabels[s], `uk.account.orderStatus.${s}`).toBeTruthy();
      expect(orderStatusLabels[s]).toMatch(/[Ѐ-ӿ]/);
    }
  });

  it("labels every PaymentStatus value in uk.json", () => {
    const values = Object.values(PaymentStatus);
    expect(values.length).toBeGreaterThan(0);
    for (const s of values) {
      expect(paymentStatusLabels[s], `uk.account.paymentStatus.${s}`).toBeTruthy();
      expect(paymentStatusLabels[s]).toMatch(/[Ѐ-ӿ]/);
    }
  });
});
