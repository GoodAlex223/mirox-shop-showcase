# Message catalogs (TASK-039)

- `uk.json` — source of truth; the schema. Every UI string lives here.
- `ru.json` — agent-translated, then reviewed (ruled: «Нова Пошта» stays
  undeclined, «ё» stays; the nuance list below remains the read-through
  checklist). RU deep-merges over UK at request time; a missing RU key renders the UA value.

Nuance-flagged for review (gate + client): `home.hero.*`, `brand.*`,
`site.announcement.*`, `home.whyChooseUs.*`, testimonial/claims copy.

Conventions: namespaces mirror UI domains; `admin.*` populated in G13 — **UA-only
by decision** (2026-08-16): RU deliberately has no admin keys; the deep-merge
fallback renders UA for RU-toggled admins. The root layout strips `admin.*`
from the storefront client payload; the `(admin)` layout re-provides the full
catalog (provider split, G13 spec §2). ICU plurals carry all four branches
(one/few/many/other); keys are camelCase; byCode keys are the verbatim API
codes. Extraction is byte-identical from the pre-i18n literals — verified by
`scripts/i18n-byte-diff.mjs`.

## RU draft nuances (flag for gate + client review)

- **Нова Пошта stays undeclined.** The carrier brand name is never rendered
  as «Новая Почта» (wrong brand) and never grammatically declined into
  Russian case endings either (e.g. not «Новой Почты», «Новую Пошту»).
  Every RU string keeps the nominative Ukrainian brand form «Нова Пошта»
  verbatim, with the surrounding Russian sentence built around it as an
  appositive (`shipping.np-office`: «Нова Пошта — отделение»;
  `cart.summary.shippingValue`: «По тарифам Нова Пошта»;
  `products.detail.shippingNote`: «Доставка Нова Пошта»). This mirrors how
  the source `uk.json` already treats the brand as an undeclined dash-appositive
  in the `shipping.*` keys — Task 9 extends the same pattern to the two prose
  spots (`cart.summary.shippingValue`, `products.detail.shippingNote`) that
  had declined the brand grammatically in Ukrainian («Нової Пошти», «Новою
  Поштою»). **Flagging because this is a real style call, not a mechanical
  rule** — colloquial RU e-commerce copy in Ukraine often _does_ decline or
  even mistranslate the brand («Новая почта»); the client may prefer a
  different appositive phrasing (e.g. inserting «перевозчика» before the
  brand name) even though the brand-identity rule itself is fixed.
- **Claims/marketing copy** (`home.hero.*`, `brand.*`, `site.announcement.*`,
  `home.whyChooseUs.*`, `home.testimonials.title`): translated in full, but
  these carry the same client-approval dependency the UA originals do — nail
  down final RU marketing phrasing with the client before launch, not just
  grammatical correctness.
- **Grammatical gender resolved per-string, not blanket-impersonal.** Ukrainian
  leans on gender-invariant impersonal predicates (`-но`/`-то` forms:
  «Скасовано», «Товар не знайдено») that work regardless of the implied
  subject's grammatical gender. Russian nouns for the same concepts have
  fixed genders that don't match Ukrainian's (`замовлення` neuter in UA vs.
  `заказ` masculine in RU; `категорія`/`категория` feminine in both). The
  draft resolves each case individually rather than translating the
  impersonal form literally:
  - Standalone status badges (`account.orderStatus.*`,
    `account.orderDetail.timeline.{processing,shipped,delivered,cancelled}`)
    stay impersonal/neuter in RU too («Подтверждено», «Отправлено»,
    «Отменено») — these render as context-free badge text (order list,
    filters) with no adjacent subject noun, matching how Nova Poshta's own
    RU tracking UI labels shipment states.
  - Where the RU string names its subject explicitly
    (`account.orderDetail.timeline.{placed,confirmed}`: "Заказ оформлен" /
    "Заказ подтверждён"), the predicate takes masculine agreement with
    «заказ» — the impersonal neuter here would be a grammar error in Russian
    with an explicit masculine subject present.
  - "Not found" messages agree with the RU noun's actual gender: «Товар не
    найден» (masc., matches `товар`), «Заказ не найден» (masc., matches
    `заказ`), «Категория не найдена» (fem., matches `категория`), «Страница
    не найдена» (fem., matches `страница`) — never a blanket neuter
    translation of UA's «не знайдено».
  - `account.paymentStatus.*` keeps UA's own mixed pattern verbatim in intent:
    impersonal/neuter for PAID/REFUNDED/PARTIALLY_REFUNDED («Оплачено»,
    «Возвращено», «Частично возвращено» — no ё, stress shifts off that
    syllable in the neuter short form), feminine agreement for FAILED («Не
    удалась», matching `оплата`, fem.) exactly as UA's «Не вдалася» already
    does (mirroring the source's own choice, not inventing new asymmetry).
  - This is a judgment call, not a mechanical transform — worth a native-RU
    read-through alongside the client sign-off pass.
- **ё is spelled out** where standard orthography calls for it (ещё, всё
  [= "everything", vs. "все" = "all"], подтверждён, отменён, добавлен, etc.)
  rather than the common informal practice of collapsing it to е. Chosen for
  consistency with a careful, client-facing draft register; a copy-editor
  pass may reasonably flatten this to match a house style if the client
  prefers the informal spelling.
- **`track.*` (G18, 2026-09-04)** — guest order lookup + status page. Same
  gender resolution as the order-status badges: «Заказ с таким номером … не
  найден» takes masculine agreement because the subject noun is present;
  `TOO_MANY_ATTEMPTS` keeps the `{minutes}` ICU argument in both locales
  («через {minutes} хв.» / «через {minutes} мин.»). Draft, pending the same
  client sign-off as the rest of the RU catalog.
