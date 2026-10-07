// URL slugs for admin-entered product and category names (G24).
//
// Ukrainian → Latin follows the national standard: Cabinet of Ministers of
// Ukraine Resolution No. 55 of 2010-01-27, current edition 2016-01-12 —
// https://zakon.rada.gov.ua/laws/show/55-2010-%D0%BF (the passport and
// road-sign table). Two rules go beyond letter-for-letter:
//   - є ї й ю я are ye yi y yu ya at the start of a word and ie i i iu ia
//     elsewhere. An apostrophe does not start a word (the table's «Мар'їне» →
//     Marine), so it is skipped without touching that state;
//   - «зг» is zgh, to keep it apart from ж → zh.
// The soft sign and the apostrophe are not rendered.
//
// ё ы э ъ are Russian-only letters the standard does not cover. They get a
// best-effort mapping so a name typed in Russian still comes out readable;
// Russian letters shared with Ukrainian take the Ukrainian values.
//
// The table is data, not display copy, so it lives here rather than in
// messages/*.json. Pure and import-free: the admin forms (client components)
// and the admin API routes share it. Tested against every example pair of the
// Resolution's table in tests/unit/slug.test.ts.

const LETTERS: Readonly<Record<string, string>> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  // Russian-only, best effort (no standard).
  ы: "y",
  э: "e",
  ъ: "",
};

// [at the start of a word, elsewhere]
const POSITIONAL: Readonly<Record<string, readonly [string, string]>> = {
  є: ["ye", "ie"],
  ї: ["yi", "i"],
  й: ["y", "i"],
  ю: ["yu", "iu"],
  я: ["ya", "ia"],
  // Russian-only, best effort — modelled on є/ю/я.
  ё: ["yo", "io"],
};

// The apostrophe forms keyboards, autocorrect and pasted text produce: U+0027,
// U+2019, U+2018, U+02BC (the one Ukrainian orthography prescribes), U+02BB,
// U+0060, and U+00B4 (the acute accent, often typed in its place).
const APOSTROPHES = new Set(["\u0027", "\u2019", "\u2018", "\u02BC", "\u02BB", "\u0060", "\u00B4"]);

export function generateSlug(input: string): string {
  let latin = "";
  let inWord = false;
  let previous = "";

  // NFC first: decomposed text (macOS file names, some clipboards) spells й as
  // и + U+0306, and the stray combining mark would become a hyphen mid-word.
  for (const char of input.normalize("NFC").toLowerCase()) {
    if (APOSTROPHES.has(char)) continue;

    const positional = POSITIONAL[char];
    const letter = LETTERS[char];
    if (positional !== undefined) {
      latin += inWord ? positional[1] : positional[0];
      inWord = true;
    } else if (letter !== undefined) {
      latin += char === "г" && previous === "з" ? "gh" : letter;
      inWord = true;
    } else {
      latin += char;
      inWord = /[a-z0-9]/.test(char);
    }
    previous = char;
  }

  return latin.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * The typed slug when it carries anything but whitespace; otherwise undefined,
 * meaning "not typed — derive it". The one blank rule for slugFromInput and the
 * PUT routes, so they cannot drift apart (an untrimmed check once stored "   ").
 */
export function nonBlankSlug(slug: string | null | undefined): string | undefined {
  return slug?.trim() ? slug : undefined;
}

/**
 * The slug a write path stores: the typed slug when it is not blank, otherwise
 * the name — either way through generateSlug. An empty result means the source
 * carried no letter or digit; callers reject it (SLUG_EMPTY) rather than store
 * "". A typed slug that comes out empty is not swapped for the name, which
 * would hide what the client typed.
 */
export function slugFromInput(slug: string | null | undefined, name: string): string {
  return generateSlug(nonBlankSlug(slug) ?? name);
}
