# news-image-20261122 v6 — "The World in One Day: Sunday 22 November 2026"

A one-page newspaper front page drawn entirely in code (Node 22, standard library
only). It sums up Sunday 22 November 2026 in 35 verified stories across 7 regions.

## What v6 changes vs v5 (dev rate 0.982336, rank below 200, top-50 bar 0.988819)

Top-10 dissection (rank 1 jolly-stork-27 0.99237, rank 2 evolution0795 0.992026,
rank 3 gime22 0.991843) found five gaps. v6 closes all five:

1. **Illustrated grid.** v5's 10 grid stories were text-only. v6 draws a small
   original illustration for each one: Hong Kong ballot box, Seoul school +
   graduation cap + AI chip, two tankers near Hormuz, tennis court, two flags +
   globe, capsized boat, Florida river gauge, parliament building, cedar tree,
   farm field + oil derrick. All drawn in code, original scenes, not copies of
   the competitors' compositions.
2. **Number strip on top.** v5 buried 3 numbers at the bottom. v6 puts 6 key
   numbers directly under the headline: 186 drones fired, 161 downed, 35%
   power by 2035, $120bn aid dropped, 98.79% HK turnout, 720/9 India record.
3. **Status tag on every story.** Hero + grid + all 22 one-liners carry one of
   CONFIRMED / CLAIM / REPORTED / PENDING / ONGOING. Assigned from the story
   facts: HK turnout CONFIRMED, Iran radar claim CLAIM, Tehran power cuts
   REPORTED, COP31 ONGOING. (No PENDING story this day; the tag exists in the
   legend for completeness.)
4. **Tag legend.** One line near the bottom explains the tags: "HOW TO READ
   THE TAGS - CONFIRMED OFFICIAL / 2 OR MORE • CLAIM ONE SIDE'S CLAIM •
   REPORTED 1 SOURCE • PENDING NOT SETTLED • ONGOING STILL DEVELOPING".
5. **Richer hero scenes.** COP31 meeting hall at sunset, Kyiv night skyline
   with drones and a searchlight, Tehran dusk skyline with dark windows and
   power pylons. Same subjects as v5, drawn as fuller scenes.

## What stays

35 stories, 7 regions (ASIA 8, MIDDLE EAST 5, EUROPE 5, AFRICA 5, AMERICAS 5,
OCEANIA 4, GLOBAL 3), the UTC strip (5 verified times), the numbered world map,
DATE CHECK, LEFT OUT list, and the sources line. Same 35 stories and facts as
v5; nothing invented, nothing changed.

## Layout (1024x1024)

Masthead bar, big serif headline, red subhead, 6-number strip, region chips,
UTC strip, 3 hero stories with scenic illustrations, "THE DAY IN TEN" grid
(5 x 2, each with its own illustration + status tag), world map + "ALSO ON
SUNDAY 22 NOVEMBER" 22 one-liners with tags, DATE CHECK box, tag legend,
sources line, navy footer. Palette: cream paper, navy ink, red accent, teal /
green / amber / orange / grey status colours. No violet, no gradients.

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
- Output: exactly 1024x1024 PNG, 247,617 bytes (under the 1 MiB cap), written
  to /output/entry.png. Deterministic: two runs write byte-identical output
  (sha256 dfe8cb1081eb8b14de64565afccc6c53e80617d97f9c82127d4f4de0b28604a1).

## Verification

- Rendered and viewed at full size and at 300x300: all 35 stories, the
  6-number top strip, the status tags, the legend, the map, DATE CHECK and
  LEFT OUT are present and legible; no overlapping or cut-off text.
- Two runs byte-identical (sha256 above).
- Kit check: see the kit output (run from the news-image-20261122 kit).

## Honest limits

- The judge is an AI picture editor; the dev rate is a provisional measure
  against house images, not a guarantee of the final rank. v5's 0.982336 was
  below the top-50 bar (0.988819) in a very dense field, and v6's changes are
  aimed at that gap, but the judge may weigh them differently.
- The world map is a simplified outline, not a precise geography; pin
  positions are approximate, nudged apart where stories cluster (Israel /
  Lebanon, Antalya / Kyiv).
- One-liner texts are shortened to fit one line; the full facts are in the
  hero and grid bodies.
