/**
 * Fetch TTF subsets of Manrope (400 + 800) covering exactly the glyphs in
 * `text`, via the Google Fonts css2 API. Satori (the renderer behind
 * `next/og`'s `ImageResponse`) can only parse raw TrueType/OpenType font
 * data — not woff/woff2 — so the request must trick Google into serving a
 * `format('truetype')` (or `'opentype'`) source instead of its modern
 * default. Returns [] on ANY failure so callers fall back to Satori's
 * bundled font: the OG route must never 500 over a font fetch; worst case
 * is tofu on Cyrillic glyphs.
 *
 * UA note: the commonly-cited trick is an IE11 User-Agent. Probed live from
 * this environment, Google now serves IE11 `format('woff')` (WOFF v1, not
 * even woff2) — never truetype/opentype — so that string would make this
 * helper silently always return []. The UA below (old Safari 5.0.5 / Mac OS
 * X 10.6.8) is the exact string Next's own bundled `@vercel/og` uses
 * internally for this identical purpose (see its compiled `loadGoogleFont`
 * in `next/dist/compiled/@vercel/og`), and was verified here — repeatedly,
 * both weights — to reliably return `format('truetype')`.
 */
export interface OgFont {
  name: "Manrope";
  data: ArrayBuffer;
  weight: 400 | 800;
}

const LEGACY_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

export async function loadManropeForOg(text: string): Promise<OgFont[]> {
  try {
    const load = async (weight: 400 | 800): Promise<OgFont> => {
      const css = await fetch(
        `https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}&text=${encodeURIComponent(text)}`,
        {
          headers: {
            "User-Agent": LEGACY_UA,
          },
        }
      ).then((r) => r.text());
      const url = css.match(
        /src:\s*url\((https:[^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/
      )?.[1];
      if (!url) throw new Error(`no TTF URL for weight ${weight}`);
      const data = await fetch(url).then((r) => r.arrayBuffer());
      return { name: "Manrope", data, weight };
    };
    return await Promise.all([load(400), load(800)]);
  } catch {
    return [];
  }
}
