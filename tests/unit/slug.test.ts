import { describe, it, expect } from "vitest";
import { generateSlug, nonBlankSlug, slugFromInput } from "@/lib/slug";

// ---------------------------------------------------------------------------
// Oracle: Cabinet of Ministers of Ukraine Resolution No. 55 (2010-01-27),
// «Таблиця транслітерації українського алфавіту латиницею», current edition
// 2016-01-12 — https://zakon.rada.gov.ua/laws/show/55-2010-%D0%BF (fetched
// 2026-10-02). Every example pair of the table plus note 1's two «зг» examples,
// in table order. Expected = the official Latin column lowercased, the one
// space («Біла Церква») hyphenated. Literals, never computed.
// ---------------------------------------------------------------------------

const KMU_55_EXAMPLES: ReadonlyArray<readonly [string, string]> = [
  ["Алушта", "alushta"],
  ["Андрій", "andrii"],
  ["Борщагівка", "borshchahivka"],
  ["Борисенко", "borysenko"],
  ["Вінниця", "vinnytsia"],
  ["Володимир", "volodymyr"],
  ["Гадяч", "hadiach"],
  ["Богдан", "bohdan"],
  ["Згурський", "zghurskyi"],
  ["Ґалаґан", "galagan"],
  ["Ґорґани", "gorgany"],
  ["Донецьк", "donetsk"],
  ["Дмитро", "dmytro"],
  ["Рівне", "rivne"],
  ["Олег", "oleh"],
  ["Есмань", "esman"],
  ["Єнакієве", "yenakiieve"],
  ["Гаєвич", "haievych"],
  ["Короп'є", "koropie"],
  ["Житомир", "zhytomyr"],
  ["Жанна", "zhanna"],
  ["Жежелів", "zhezheliv"],
  ["Закарпаття", "zakarpattia"],
  ["Казимирчук", "kazymyrchuk"],
  ["Медвин", "medvyn"],
  ["Михайленко", "mykhailenko"],
  ["Іванків", "ivankiv"],
  ["Іващенко", "ivashchenko"],
  ["Їжакевич", "yizhakevych"],
  ["Кадиївка", "kadyivka"],
  ["Мар'їне", "marine"],
  ["Йосипівка", "yosypivka"],
  ["Стрий", "stryi"],
  ["Олексій", "oleksii"],
  ["Київ", "kyiv"],
  ["Коваленко", "kovalenko"],
  ["Лебедин", "lebedyn"],
  ["Леонід", "leonid"],
  ["Миколаїв", "mykolaiv"],
  ["Маринич", "marynych"],
  ["Ніжин", "nizhyn"],
  ["Наталія", "nataliia"],
  ["Одеса", "odesa"],
  ["Онищенко", "onyshchenko"],
  ["Полтава", "poltava"],
  ["Петро", "petro"],
  ["Решетилівка", "reshetylivka"],
  ["Рибчинський", "rybchynskyi"],
  ["Суми", "sumy"],
  ["Соломія", "solomiia"],
  ["Тернопіль", "ternopil"],
  ["Троць", "trots"],
  ["Ужгород", "uzhhorod"],
  ["Уляна", "uliana"],
  ["Фастів", "fastiv"],
  ["Філіпчук", "filipchuk"],
  ["Харків", "kharkiv"],
  ["Христина", "khrystyna"],
  ["Біла Церква", "bila-tserkva"],
  ["Стеценко", "stetsenko"],
  ["Чернівці", "chernivtsi"],
  ["Шевченко", "shevchenko"],
  ["Шостка", "shostka"],
  ["Кишеньки", "kyshenky"],
  ["Щербухи", "shcherbukhy"],
  ["Гоща", "hoshcha"],
  ["Гаращенко", "harashchenko"],
  ["Юрій", "yurii"],
  ["Корюківка", "koriukivka"],
  ["Яготин", "yahotyn"],
  ["Ярошенко", "yaroshenko"],
  ["Костянтин", "kostiantyn"],
  ["Знам'янка", "znamianka"],
  ["Феодосія", "feodosiia"],
  ["Згорани", "zghorany"],
  ["Розгон", "rozghon"],
];

// What an admin will actually type: realistic product names and a
// mixed-script name.
const INTAKE_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["Олімпійка з лампасами, чорна", "olimpiika-z-lampasamy-chorna"],
  ["полузамок в'язаний", "poluzamok-viazanyi"],
  ["зіп-худі", "zip-khudi"],
  ["ранець", "ranets"],
  ["Худі Mirox Basic", "khudi-mirox-basic"],
];

// The table's own examples only ever start a word at the start of the string.
// A space, a hyphen or a quote starts a new word too; an apostrophe inside a
// word does not (the table's «Мар'їне» → Marine).
const WORD_STARTS: ReadonlyArray<readonly [string, string]> = [
  ["Худі Юнісекс", "khudi-yuniseks"],
  ["Светр-Ялинка", "svetr-yalynka"],
  ["'Ялинка'", "yalynka"],
];

// The apostrophe forms keyboards, autocorrect and pasted text produce, including
// the left quote and the acute accent typed in its place. None may become a
// hyphen ("znam-ianka") or restart the word ("znamyanka"): the table says the
// apostrophe is not rendered at all. Escapes, not literals, so each form is visible.
const APOSTROPHES: ReadonlyArray<readonly [string, string]> = [
  ["U+0027", "Знам\u0027янка"],
  ["U+2019", "Знам\u2019янка"],
  ["U+2018", "Знам\u2018янка"],
  ["U+02BC", "Знам\u02BCянка"],
  ["U+02BB", "Знам\u02BBянка"],
  ["U+0060", "Знам\u0060янка"],
  ["U+00B4", "Знам\u00B4янка"],
];

// Decomposed (NFD) text — macOS file names, some clipboards and PDFs — spells
// й as и + U+0306 and ї as і + U+0308. Unnormalized, the combining mark became
// a hyphen inside the word ("mykhay-lenko").
const DECOMPOSED: ReadonlyArray<readonly [string, string]> = [
  ["Михайленко", "mykhailenko"],
  ["Їжакевич", "yizhakevych"],
  ["Олімпійка", "olimpiika"],
];

// No standard backs these — a best-effort mapping so a Russian-typed name
// never comes out mangled («чёрный» must not become "ch-rn-i").
const RUSSIAN_ONLY: ReadonlyArray<readonly [string, string]> = [
  ["Свитер чёрный", "svyter-chiornyi"],
  ["Ёлка", "yolka"],
  ["Эко-сумка", "eko-sumka"],
];

// Pre-existing behaviour for Latin input, moved here from api-utils.test.ts.
const LATIN: ReadonlyArray<readonly [string, string]> = [
  ["My Product Name", "my-product-name"],
  ["Hello & World! #1", "hello-world-1"],
  ["--test--", "test"],
  ["a   b   c", "a-b-c"],
  ["Electronics", "electronics"],
];

describe("generateSlug — KMU-55 table examples", () => {
  it.each(KMU_55_EXAMPLES)("%s → %s", (input, want) => {
    expect(generateSlug(input)).toBe(want);
  });
});

describe("generateSlug — intake names", () => {
  it.each(INTAKE_NAMES)("%s → %s", (input, want) => {
    expect(generateSlug(input)).toBe(want);
  });
});

describe("generateSlug — word starts", () => {
  it.each(WORD_STARTS)("%s → %s", (input, want) => {
    expect(generateSlug(input)).toBe(want);
  });
});

describe("generateSlug — apostrophes", () => {
  it.each(APOSTROPHES)("drops the %s apostrophe without a hyphen", (_label, input) => {
    expect(generateSlug(input)).toBe("znamianka");
  });
});

describe("generateSlug — decomposed input", () => {
  it.each(DECOMPOSED)("NFD %s → %s", (input, want) => {
    const decomposed = input.normalize("NFD");
    expect(decomposed).not.toBe(input); // the fixture really is decomposed
    expect(generateSlug(decomposed)).toBe(want);
  });
});

describe("generateSlug — Russian-only letters", () => {
  it.each(RUSSIAN_ONLY)("%s → %s", (input, want) => {
    expect(generateSlug(input)).toBe(want);
  });
});

describe("generateSlug — Latin input", () => {
  it.each(LATIN)("%s → %s", (input, want) => {
    expect(generateSlug(input)).toBe(want);
  });
});

describe("generateSlug — nothing to keep", () => {
  it.each(["", "   ", "★★★", "!!!"])("%j → empty string", (input) => {
    expect(generateSlug(input)).toBe("");
  });
});

describe("generateSlug — idempotence", () => {
  // The edit path compares a normalized slug with the stored one, so a slug
  // that is already clean must come back unchanged.
  const clean = [
    ...KMU_55_EXAMPLES,
    ...INTAKE_NAMES,
    ...WORD_STARTS,
    ...RUSSIAN_ONLY,
    ...LATIN,
  ].map(([, want]) => want);

  it.each(clean)("%s is a fixed point", (slug) => {
    expect(generateSlug(slug)).toBe(slug);
  });
});

describe("nonBlankSlug", () => {
  it("returns a typed slug unchanged — trimming and normalizing are generateSlug's job", () => {
    expect(nonBlankSlug("svetr-chornyi")).toBe("svetr-chornyi");
    expect(nonBlankSlug(" Svetr ")).toBe(" Svetr ");
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", " \t "],
    ["null", null],
    ["undefined", undefined],
  ])("treats a %s slug as not typed", (_label, typed) => {
    expect(nonBlankSlug(typed)).toBeUndefined();
  });
});

describe("slugFromInput", () => {
  it("uses the typed slug when there is one", () => {
    expect(slugFromInput("svetr-chornyi", "Худі")).toBe("svetr-chornyi");
  });

  it("normalizes a typed slug", () => {
    expect(slugFromInput("Svetr Chornyi", "Худі")).toBe("svetr-chornyi");
    expect(slugFromInput("Олімпійка чорна", "Худі")).toBe("olimpiika-chorna");
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["null", null],
    ["undefined", undefined],
  ])("falls back to the name when the typed slug is %s", (_label, typed) => {
    expect(slugFromInput(typed, "Светр чорний")).toBe("svetr-chornyi");
  });

  it("does not fall back to the name when a typed slug normalizes to nothing", () => {
    // The caller rejects this (SLUG_EMPTY) — silently swapping in a
    // name-derived slug would hide what the client typed.
    expect(slugFromInput("!!!", "Светр чорний")).toBe("");
  });
});
