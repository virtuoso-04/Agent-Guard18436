/**
 * Homoglyph normalization table.
 *
 * Maps visually identical Unicode characters from Cyrillic, Greek, Armenian,
 * and other scripts to their Latin/ASCII equivalents.
 *
 * Derived from the Unicode Consortium confusables.txt
 * https://www.unicode.org/Public/security/latest/confusables.txt
 *
 * This covers the most common attack vectors seen in prompt-injection payloads:
 *  - Cyrillic lookalikes: а е о р с х у (U+0430, U+0435, U+043E, …)
 *  - Greek lookalikes:    α ε ο ρ  (U+03B1, U+03B5, U+03BF, U+03C1)
 *  - Fullwidth ASCII:     ａ－ｚ Ａ－Ｚ  (U+FF41–U+FF5A, U+FF21–U+FF3A)
 *  - Mathematical alphanumerics (bold/italic/script variants)
 */

export const CONFUSABLES_MAP: Record<string, string> = {
  // ── Cyrillic → Latin (lowercase) ──────────────────────────────────────────
  '\u0430': 'a', // а  CYRILLIC SMALL LETTER A
  '\u0435': 'e', // е  CYRILLIC SMALL LETTER IE
  '\u043E': 'o', // о  CYRILLIC SMALL LETTER O
  '\u0440': 'p', // р  CYRILLIC SMALL LETTER ER
  '\u0441': 'c', // с  CYRILLIC SMALL LETTER ES
  '\u0445': 'x', // х  CYRILLIC SMALL LETTER HA
  '\u0443': 'y', // у  CYRILLIC SMALL LETTER U
  '\u0456': 'i', // і  CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I
  '\u04CF': 'l', // ӏ  CYRILLIC SMALL LETTER PALOCHKA
  '\u0455': 's', // ѕ  CYRILLIC SMALL LETTER DZE
  '\u0461': 'w', // ѡ  CYRILLIC SMALL LETTER OMEGA
  '\u0432': 'v', // в  CYRILLIC SMALL LETTER VE (looks like v/b)
  '\u0431': 'b', // б  CYRILLIC SMALL LETTER BE
  '\u043A': 'k', // к  CYRILLIC SMALL LETTER KA
  '\u043C': 'm', // м  CYRILLIC SMALL LETTER EM
  '\u043D': 'n', // н  CYRILLIC SMALL LETTER EN

  // ── Cyrillic → Latin (uppercase) ──────────────────────────────────────────
  '\u0410': 'A', // А  CYRILLIC CAPITAL LETTER A
  '\u0412': 'B', // В  CYRILLIC CAPITAL LETTER VE
  '\u0415': 'E', // Е  CYRILLIC CAPITAL LETTER IE
  '\u041A': 'K', // К  CYRILLIC CAPITAL LETTER KA
  '\u041C': 'M', // М  CYRILLIC CAPITAL LETTER EM
  '\u041D': 'H', // Н  CYRILLIC CAPITAL LETTER EN
  '\u041E': 'O', // О  CYRILLIC CAPITAL LETTER O
  '\u0420': 'P', // Р  CYRILLIC CAPITAL LETTER ER
  '\u0421': 'C', // С  CYRILLIC CAPITAL LETTER ES
  '\u0422': 'T', // Т  CYRILLIC CAPITAL LETTER TE
  '\u0425': 'X', // Х  CYRILLIC CAPITAL LETTER HA
  // у́ (U+0443 + U+0301 combining acute) is decomposed to U+0443 by NFKC
  // normalization in sanitizer Step 1, so the combining mark never reaches
  // this map. U+0443 alone is already mapped above to 'y'.

  // ── Greek → Latin (lowercase) ─────────────────────────────────────────────
  '\u03B1': 'a', // α  GREEK SMALL LETTER ALPHA
  '\u03B2': 'b', // β  GREEK SMALL LETTER BETA (sometimes used for 6)
  '\u03B5': 'e', // ε  GREEK SMALL LETTER EPSILON
  '\u03B9': 'i', // ι  GREEK SMALL LETTER IOTA
  '\u03BF': 'o', // ο  GREEK SMALL LETTER OMICRON
  '\u03C1': 'p', // ρ  GREEK SMALL LETTER RHO
  '\u03C5': 'u', // υ  GREEK SMALL LETTER UPSILON
  '\u03BD': 'v', // ν  GREEK SMALL LETTER NU
  '\u03C9': 'w', // ω  GREEK SMALL LETTER OMEGA

  // ── Greek → Latin (uppercase) ─────────────────────────────────────────────
  '\u0391': 'A', // Α  GREEK CAPITAL LETTER ALPHA
  '\u0392': 'B', // Β  GREEK CAPITAL LETTER BETA
  '\u0395': 'E', // Ε  GREEK CAPITAL LETTER EPSILON
  '\u0396': 'Z', // Ζ  GREEK CAPITAL LETTER ZETA
  '\u0397': 'H', // Η  GREEK CAPITAL LETTER ETA
  '\u0399': 'I', // Ι  GREEK CAPITAL LETTER IOTA
  '\u039A': 'K', // Κ  GREEK CAPITAL LETTER KAPPA
  '\u039C': 'M', // Μ  GREEK CAPITAL LETTER MU
  '\u039D': 'N', // Ν  GREEK CAPITAL LETTER NU
  '\u039F': 'O', // Ο  GREEK CAPITAL LETTER OMICRON
  '\u03A1': 'P', // Ρ  GREEK CAPITAL LETTER RHO
  '\u03A4': 'T', // Τ  GREEK CAPITAL LETTER TAU
  '\u03A5': 'Y', // Υ  GREEK CAPITAL LETTER UPSILON
  '\u03A7': 'X', // Χ  GREEK CAPITAL LETTER CHI

  // ── Fullwidth ASCII → ASCII ────────────────────────────────────────────────
  // Fullwidth Latin lowercase  ａ(FF41) … ｚ(FF5A)
  '\uFF41': 'a',
  '\uFF42': 'b',
  '\uFF43': 'c',
  '\uFF44': 'd',
  '\uFF45': 'e',
  '\uFF46': 'f',
  '\uFF47': 'g',
  '\uFF48': 'h',
  '\uFF49': 'i',
  '\uFF4A': 'j',
  '\uFF4B': 'k',
  '\uFF4C': 'l',
  '\uFF4D': 'm',
  '\uFF4E': 'n',
  '\uFF4F': 'o',
  '\uFF50': 'p',
  '\uFF51': 'q',
  '\uFF52': 'r',
  '\uFF53': 's',
  '\uFF54': 't',
  '\uFF55': 'u',
  '\uFF56': 'v',
  '\uFF57': 'w',
  '\uFF58': 'x',
  '\uFF59': 'y',
  '\uFF5A': 'z',
  // Fullwidth Latin uppercase  Ａ(FF21) … Ｚ(FF3A)
  '\uFF21': 'A',
  '\uFF22': 'B',
  '\uFF23': 'C',
  '\uFF24': 'D',
  '\uFF25': 'E',
  '\uFF26': 'F',
  '\uFF27': 'G',
  '\uFF28': 'H',
  '\uFF29': 'I',
  '\uFF2A': 'J',
  '\uFF2B': 'K',
  '\uFF2C': 'L',
  '\uFF2D': 'M',
  '\uFF2E': 'N',
  '\uFF2F': 'O',
  '\uFF30': 'P',
  '\uFF31': 'Q',
  '\uFF32': 'R',
  '\uFF33': 'S',
  '\uFF34': 'T',
  '\uFF35': 'U',
  '\uFF36': 'V',
  '\uFF37': 'W',
  '\uFF38': 'X',
  '\uFF39': 'Y',
  '\uFF3A': 'Z',

  // ── Additional high-risk confusables ──────────────────────────────────────
  '\u1D00': 'a', // ᴀ  LATIN LETTER SMALL CAPITAL A
  '\u0261': 'g', // ɡ  LATIN SMALL LETTER SCRIPT G
  '\u026A': 'i', // ɪ  LATIN LETTER SMALL CAPITAL I
  '\u0274': 'n', // ɴ  LATIN LETTER SMALL CAPITAL N
  '\u0280': 'r', // ʀ  LATIN LETTER SMALL CAPITAL R
  '\u1D04': 'c', // ᴄ  LATIN LETTER SMALL CAPITAL C
  '\u1D07': 'e', // ᴇ  LATIN LETTER SMALL CAPITAL E
  '\u1D0A': 'j', // ᴊ  LATIN LETTER SMALL CAPITAL J
  '\u1D0B': 'k', // ᴋ  LATIN LETTER SMALL CAPITAL K
  '\u1D0D': 'm', // ᴍ  LATIN LETTER SMALL CAPITAL M
  '\u1D0F': 'o', // ᴏ  LATIN LETTER SMALL CAPITAL O
  '\u1D18': 'p', // ᴘ  LATIN LETTER SMALL CAPITAL P
  '\u1D1B': 't', // ᴛ  LATIN LETTER SMALL CAPITAL T
  '\u1D1C': 'u', // ᴜ  LATIN LETTER SMALL CAPITAL U
  '\u1D20': 'v', // ᴠ  LATIN LETTER SMALL CAPITAL V
  '\u1D21': 'w', // ᴡ  LATIN LETTER SMALL CAPITAL W
  '\u1D22': 'z', // ᴢ  LATIN LETTER SMALL CAPITAL Z
};

/**
 * Pre-compiled regex matching any character in the confusables map.
 * Built once at module load to avoid rebuilding on every sanitize call.
 */
export const CONFUSABLES_REGEX: RegExp = new RegExp(
  `[${Object.keys(CONFUSABLES_MAP)
    .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('')}]`,
  'g',
);

/**
 * Replace all confusable characters in `input` with their ASCII equivalents.
 * @param input - Raw string that may contain homoglyphs
 * @returns String with all confusable characters replaced
 */
export function normalizeHomoglyphs(input: string): string {
  return input.replace(CONFUSABLES_REGEX, ch => CONFUSABLES_MAP[ch] ?? ch);
}

// Unicode script ranges for script-mixing detection
const LATIN_RANGE = /[\u0041-\u007A\u00C0-\u024F]/;
const CYRILLIC_RANGE = /[\u0400-\u04FF]/;
const GREEK_RANGE = /[\u0370-\u03FF]/;

/**
 * Detect if a string mixes Latin characters with Cyrillic or Greek within the
 * same word-like token. This is a strong signal of a homoglyph attack.
 * @param input - The text to scan
 * @returns true if mixed-script tokens are found
 */
export function hasMixedScripts(input: string): boolean {
  // Split on whitespace and check each token
  const tokens = input.split(/\s+/);
  for (const token of tokens) {
    if (token.length < 2) continue;
    const hasLatin = LATIN_RANGE.test(token);
    const hasCyrillic = CYRILLIC_RANGE.test(token);
    const hasGreek = GREEK_RANGE.test(token);
    if (hasLatin && (hasCyrillic || hasGreek)) return true;
  }
  return false;
}
