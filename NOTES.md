# news-image-20261122 v7 — "The World in One Day: Sunday 22 November 2026"

A one-page newspaper front page drawn entirely in code (Node 22, standard library
only). It sums up Sunday 22 November 2026 in 35 verified stories across 7 regions.

## What v7 changes vs v6 (dev rate 0.984958, rank 185, top-50 bar 0.988819)

A second dissection of the top 3 (rank 1 jolly-stork-27 0.99237, rank 2
evolution0795 0.992026, rank 3 gime22 0.991843) found six remaining gaps. v7
closes them:

1. **Header strip on every grid story.** v6's grid had an illustration but no
   header. v7 puts a short punchy title on a colored bar above each grid
   illustration: HONG KONG VOTES, MINISTER QUITS, 2 TANKERS HIT, ALCARAZ v
   ZVEREV, TALKS HOPE, BOAT TOLL 24, RIVER RECORD, TALKS INVITE, ARMS ROW,
   MARCOS CORRECTS TRUMP. White text on red, navy, teal or green, matched to
   the story's tone.
2. **Descriptive label bar on each hero.** v6's heroes carried only the generic
   status tag. v7 adds a black bar with white text at the bottom edge of each
   hero illustration: NO ADOPTION AT PRESS TIME (COP31), 161 DOWNED, 14
   MISSING (Kyiv), DAY 130 OF BLOCKADE (Tehran). The generic status tag stays
   in the top-right corner.
3. **UTC strip, full labels.** v6 cut two labels short (LISBON CAMP CLEAR,
   COP31 OBJECTIONS). v7 prints the full wording: 02:00 LISBON CAMP CLEARED,
   03:00 COP31 OBJECTIONS CLOSE, 06:00 161 OF 186 DRONES DOWNED, 10:00 HK
   POLLS CLOSE 98.79%, 17:00 ALCARAZ-ZVEREV FINAL. The font is smaller so the
   words fit; nothing is cut.
4. **Hero 1 body, fourth line restored.** v6 dropped the last line. v7 prints
   the full body: the text never mentions fossil fuels and sets no $120bn aid
   goal. It keeps 35% power by 2035. And admits 1.5C will be overshot.
5. **Richer grid illustrations.** v6's grid drawings were good but a few were
   close to icons. v7 draws a small scene per grid story: a ballot box with
   voters, a ministry building, two tankers at sea, a tennis court with
   players, two flags, a capsized boat, a river gauge, a skyline, a cedar
   tree, a palace. All drawn in code, original scenes, not copies.
6. **Story count stays 35.** Rank 2 and rank 3 also have 35. Count alone does
   not explain the gap, so no stories were added.

## What stays

35 stories, 7 regions (ASIA 8, MIDDLE EAST 5, EUROPE 5, AFRICA 5, AMERICAS 5,
OCEANIA 4, GLOBAL 3), the 6-number top strip (186 / 161 / 35% / $120bn /
98.79% / 720/9), the status tag on every story, the tag legend, the numbered
world map, DATE CHECK, LEFT OUT list, and the sources line. Same 35 stories
and facts as v5 and v6; nothing invented, nothing changed.

## Layout (1024x1024)

Masthead bar, big serif headline, red subhead, 6-number strip, region chips,
UTC strip, 3 hero stories with scenic illustrations and label bars,
"THE DAY IN TEN" grid (5 x 2, each with a colored header strip, its own
illustration and status tag), world map + "ALSO ON SUNDAY 22 NOVEMBER" 22
one-liners with tags, DATE CHECK box, tag legend, sources line, navy footer.
Palette: cream paper, navy ink, red accent, teal / green / amber / orange /
grey status colours. No violet, no gradients.

## How it is drawn

- `main.ts` — the entry program (Node 22, standard library only). It builds a
  1024x1024 RGBA framebuffer with its own drawing primitives (rect, line,
  circle, ellipse, polygon, sky bands), renders text from a pre-rendered
  DejaVu font atlas, and writes a PNG with its own encoder (zlib deflate,
  CRC32). No network, no dependencies.
- `font-atlas.bin` — a data asset (not code): a JSON header line of glyph
  metrics followed by raw grayscale coverage bytes. Families: DejaVu Serif
  Bold (scales 5/3/2), DejaVu Sans Bold (2/1), DejaVu Sans (2/1), DejaVu
  Serif regular (scale 1). Character set is uppercase A-Z, 0-9, and the
  punctuation ` $%'(),-./:;` plus the bullet and check mark. The program
  uppercases all text, so no lowercase is needed.
- Output: exactly 1024x1024 PNG, under the 1 MiB cap, written to
  /output/entry.png. Deterministic: two runs write byte-identical output.

## Verification

- Rendered and viewed at full size and at 300x300: all 35 stories, the
  6-number top strip, the grid header strips, the hero label bars, the status
  tags, the legend, the map, DATE CHECK and LEFT OUT are present and legible;
  no overlapping or cut-off text.
- Two runs byte-identical.
- Kit check: see the kit output (run from the news-image-20261122 kit).

## Honest limits

- The judge is an AI picture editor; the dev rate is a provisional measure
  against house images, not a guarantee of the final rank. v6's 0.984958 was
  below the top-50 bar (0.988819) in a very dense field, and v7's changes are
  aimed at that gap, but the judge may weigh them differently.
- The world map is a simplified outline, not a precise geography; pin
  positions are approximate, nudged apart where stories cluster (Israel /
  Lebanon, Antalya / Kyiv).
- One-liner texts are shortened to fit one line; the full facts are in the
  hero and grid bodies.
