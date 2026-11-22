# news-image-20261122 — NOTES

**Competition:** news-image-20261122 — "Sum up 22 November's world news in one image"
**Date covered:** Sunday 22 November 2026 (all stories happened, or were first reported, on this day)
**Stories:** 35 (3 hero + 10 grid + 22 one-liners)
**Regions (v2):** ASIA 8 · MIDDLE EAST 5 · EUROPE 5 · AFRICA 5 · AMERICAS 5 · OCEANIA 4 · GLOBAL 3

## v5 changes (22 Nov 2026, hero body copy + UTC timeline — closing the top-3 gap)

**Why:** direct review of v4 against the actual rank 1 (jolly-stork-27) and
rank 2 (gime22) images found two gaps: (1) their heroes carry 3–4 lines of
full body copy, ours only a 2-line caption; (2) both have a "THE DAY IN
UTC" strip, we had none. Both fixed here; nothing else changed in content
(all 35 stories, sources, dates, region counts identical).

**Gap 1 — hero body copy (3–4 lines + SOURCES line per hero):**
- New atlas glyph set: regular-weight DejaVu Serif at a 10px cap
  ("serifr", scale 1 — 50 more glyphs, atlas 128,525 → 135,995 bytes).
  Bold serif is too wide for a body column (~24 chars/line at 12px, ~30 at
  10px); the regular weight fits ~35 chars/line in the 296px hero column,
  so real body copy fits in 4 lines. Same DejaVu Serif family as the
  headlines, smaller size, as a real newspaper sets body text.
- New `wrapBalanced()` in main.ts: a DP wrap that packs text into at most
  4 lines with balanced widths (plain greedy left orphans like a lone
  "missing." on line 5). Falls back to greedy wrap if 4 lines is
  geometrically impossible.
- Body copy (all facts from NOTES.md / verified by search 22 Nov 2026;
  each wraps to exactly 4 lines at 10px/13px advance = 1.3x leading):
  - #1 COP31: "The text never mentions fossil fuels and sets no $120bn aid
    goal. It keeps 35% power by 2035 - and admits 1.5C will be overshot."
    Sources: CARBON BRIEF • REUTERS • THE GUARDIAN.
  - #2 Kyiv: "Russia fired 186 drones, 72 jet-powered. Air defence downed
    161, but 18 sites were hit and a Dymer block fell, 14 missing."
    Sources: REUTERS. ("overnight" trimmed from an earlier draft — the
    DP could not fit it in 4 lines; the night attack is already in the
    headline, caption and night-scene illustration.)
  - #3 Iran: "Rolling cuts of up to two hours a day begin as fuel runs
    short. Strikes on gas plants bite, and the US blockade hits day 130."
    Sources: RFE/RL • FRANCE 24. (Two-hour cuts + gas-strike cause
    verified by search 22 Nov 2026: Tavanir/RFE/RL/Straits Times — cuts
    "up to two hours a day", Pezeshkian on gas-network strikes.)
- The old 2-line hero captions are superseded (the `cap` field stays in
  the data as the story summary; heroes now draw body + sources instead).

**Gap 2 — "THE DAY IN UTC" strip (one row, directly under the region
strip, dark bar, yellow label, bold white times, regular white labels):**
- 02:00 LISBON CAMP CLEARED — NOTES.md v2 (police cleared the Rossio
  Square encampment ~02:00 Sun; Lisbon is UTC+0 in November).
- 03:00 COP31 OBJECTIONS CLOSE — Reuters / The Curtain / CarrZee (all
  agree delegations had until 03:00 GMT to lodge objections).
- 06:00 161 OF 186 DRONES DOWNED — Ukrainian Air Force "as of 08:00"
  Kyiv time = 06:00 UTC (Kyiv is UTC+2/EET in winter).
- 10:00 HK POLLS CLOSE 98.79% — polls close 6pm HKT = 10:00 UTC;
  turnout 98.79% (info.gov.hk / China Daily).
- 17:00 ALCARAZ-ZVEREV FINAL — final scheduled 18:00 CET = 17:00 GMT
  (tennis365 / predictionist "2026-11-22T17:00:00Z").
- All five items tie to stories already in our 35 (#22, #1, #2, #4, #7).
  An earlier 6-item draft (with 08:27 Hamas seeks talks, PressTV
  08:27 GMT) measured 1,107px — too wide for the 984px bar — so Hamas
  was dropped; the 5-item strip measures 949px (label 84px + items
  795px + 5×18px gaps, ends x=997, bar ends x=1004).
- No text copied from the competitors: only the layout pattern (a UTC
  strip under the region strip) was noted; every time and label was
  verified independently by search.

**Layout rebalancing (to fit the UTC strip + taller heroes in 1024px):**
- Masthead compressed 10px (rule 78 → 68); region strip 30 → 28px tall.
- UTC strip: y=100, 20px tall. Heroes: y=122, height 204 → 228px
  (scene stays 72px; headline 2 lines; body 4 lines × 13px; sources
  line at panel bottom −14). Grid: y=350 (unchanged 100px tiles).
- Map/ALSO header 518 → 552; map 542/226px → 576/190px (pins still
  legible at 2x zoom); key numbers 768/54px → 766/52px; LEFT OUT header
  826, items from 846; footer rule 951, DATE CHECK 959, sub-lines
  979/991, bottom line 1007.
- ALSO list pitch 18 → 17px — the one trade-off: the bottom block is
  geometrically capped by the footer (22 rows must end before the footer
  rule at y=951), and the UTC strip + hero growth needed ~50px. The
  zebra striping keeps the 17px rows distinct; the 3px air is the
  tightest block on the page, as it was in v4.
- Grid tiles, story text, region counts, DATE CHECK and LEFT OUT
  unchanged.

**Verification (v5):**
- `node main.ts` runs cleanly; output written to `/output/entry.png` and `out/entry.png`.
- Three runs byte-identical (sha256 `7baaf86c34644a3ddf747f4c95f4bf55ab1af9402ca03f8cf4d87c1e485107d0`).
- Size 284,394 bytes (≤ 1 MiB), exactly 1024×1024 PNG.
- Rendered and viewed at full size, at 300×300, and at 2x crops of the
  hero row and the map: each hero has headline + 4 lines of body copy +
  sources line, all readable with clear air between lines; UTC strip
  present with all 5 verified times; no overlapping or cut-off text;
  all 35 stories present; region strip fits (952/984px); map pins
  legible (incl. Samoa #32 at the left edge and Wellington #34 at the
  right edge); DATE CHECK ✓ and LEFT OUT intact.

## v4 changes (22 Nov 2026, line spacing — text was too tight top-to-bottom)

**Why:** the user said the text was still too tight vertically. In v3 the
multi-line blocks had almost no air: hero headlines 22px advance on a 21px
cap (1px air), hero captions 15px on a 14px cap (1px air), grid captions
8px on a 7px cap (1px air). The hero source line was also hidden — the
2-line captions ran over it (in v3 "CARBON BRIEF" / "REUTERS" / "RFE/RL"
were overlapped by the second caption line).

**Line-height changes (all ~1.3× cap height now):**
- Hero headlines (serif scale 3, 21px cap): advance 22 → 27px.
- Hero captions (sans scale 2, 14px cap): advance 15 → 18px.
- Grid headlines (serif scale 2, 12px cap): advance 15 → 16px.
- Grid captions (sans scale 1, 7px cap): advance 8 → 9px.
- Key-numbers labels: moved from y+36 to y+38 (9px air under the number).
- ALSO list: pitch stays 18px — it is geometrically capped by the footer
  (22 rows from y=542 must end before the footer rule at y=940; 19px would
  need the footer at y≥955, past the page bottom). Its 4px air was already
  the loosest of the tight blocks, so it is unchanged.

**Layout rebalancing (to fit the looser leading; no story removed, no
content or region counts changed):**
- Hero panels grew 190 → 204px; the hero source line is now placed
  dynamically (max of panel bottom −14 and caption end +4) so it can never
  be overlapped by a 2-line caption again — the three hero sources are
  visible in v4 for the first time.
- Caption start is now computed from the headline's actual end
  (headline end +4 in heroes, +2 in grid tiles) instead of a fixed offset,
  so 1-line headlines no longer leave a dead gap.
- Grid moved down 302 → 316; "WHERE IT HAPPENED" and the ALSO header moved
  502 → 518; the map moved 528 → 542 and shrank 240 → 226px tall so it
  still ends at y=768 (key numbers, LEFT OUT and footer unchanged).
- The hero scene stays 72px (the illustrations were drawn for that height;
  shrinking it would push the drone skyline / globe document out of frame).

**Verification (v4):**
- `node main.ts` runs cleanly; output written to `/output/entry.png` and `out/entry.png`.
- Two runs byte-identical (sha256 `7fe452856521d7d81590fd0d498710c7e213f818de30a695aa757bae85539394`).
- Size 269,959 bytes (≤ 1 MiB), exactly 1024×1024 PNG.
- Rendered and viewed at full size and at 300×300: clear air between every
  pair of text lines (hero headlines/captions, grid headlines/captions,
  key-numbers labels), no overlapping or cut-off text, hero sources now
  visible, all 35 stories present, region strip fits, map pins legible,
  DATE CHECK ✓ and LEFT OUT intact.

## v3 changes (22 Nov 2026, font rebuild — smooth DejaVu atlas)

**Why:** the 5×7 pixel bitmap font looked rough next to the top leaderboard
entries, which use smooth newspaper fonts (serif headlines, clean sans).
The user asked whether the leaders use a font like ours — they do not.
Checked the rank-2 image directly: smooth serif/sans throughout.

**How (atlas approach):** the make.fun sandbox runs standard library only —
PIL is NOT available there, so a Python+PIL entry would crash. The entry
stays a Node 22 program (main.ts, node built-ins only). The smooth font is
delivered as a FONT ATLAS: DejaVu glyphs rendered locally with PIL (this
machine) and shipped as a data file in the repo.
- Local build tool `../gen_atlas.py` (not part of the entry) renders glyphs
  with PIL at 4× supersampling, downsamples with LANCZOS, and writes
  `repo/font-atlas.bin` (128,525 bytes): a JSON header line (glyph metrics)
  + raw grayscale bytes. No PNG for the atlas (the program would need a
  PNG decoder). Glyph coverage = alpha for blending.
- Fonts/sizes (cap heights): DejaVu Serif Bold at scales 5 (35px, masthead),
  3 (21px, hero headlines + key numbers), 2 (12px, grid headlines — reduced
  from 14px because a 14px serif-bold "PAKISTAN HOPES FOR DEAL" cannot split
  into two lines that fit the 172px tile); DejaVu Sans Bold at scales 2
  (14px, region strip/labels) and 1 (7px, badges/kickers); DejaVu Sans at
  scales 2 (14px, hero caps/ALSO list/footer) and 1 (7px, body/sources).
  350 glyphs (7 font/size combos × 50 chars). Character set = the exact 50
  rendered characters (drawText uppercases, so A-Z + 0-9 + punctuation
  ` $%'(),-./:;•✓`).
- main.ts: the 5×7 GLYPHS table is gone. `drawText`/`drawTextBold`/
  `drawTextCentered` now blit atlas glyphs with alpha blending; new
  `drawSerif`/`drawSerifCentered` for the serif headlines. `textWidth`/
  `wrapText`/`balanceLines` use the glyphs' real proportional advances.
  Layout, positions, colours, map, illustrations, story text, region
  counts, DATE CHECK and LEFT OUT are unchanged — only glyph rasterisation.
- `by` is measured from the CAP TOP, so uppercase letters sit exactly where
  the old 7px-tall glyphs sat; line heights and centring are unchanged.

**Verification (v3):**
- `node main.ts` runs cleanly; output written to `/output/entry.png` and `out/entry.png`.
- Two runs byte-identical (sha256 `48d0096720a1a22655979579f01a346eada62097454a27e51b80ba2849bae8e7`).
- Size 270,359 bytes (≤ 1 MiB; larger than v2's 41,497 because smooth
  anti-aliased text compresses less well), exactly 1024×1024 PNG.
- Rendered and viewed at full size and at 300×300: text is smooth (DejaVu
  serif headlines, clean sans body), no overlapping or cut-off text, region
  strip fits (952/984px), all 35 stories present, map pins legible, DATE
  CHECK ✓ and LEFT OUT intact. All width checks pass (longest ALSO line
  474/484px; footer SOURCES 904/984px).

## v2 changes (22 Nov 2026, pre-submit revision)

**Weak spot 1 — generic attributions fixed.** All 12 one-liners that were labelled only "(REPORTS)", "(PAPERS)" or "(SUNDAY PAPERS)" now carry a specific, verified outlet (each confirmed by search to have reported the story on/around Sun 22 Nov 2026):
- #19 Bitcoin → BLOOMBERG (Bloomberg via TradingView, published 22 Nov 05:24 UTC, BTC ~$58,900 on 22 Nov)
- #20 Nvidia → REUTERS (Reuters reported the SEC examination behind the slide)
- #22 Lisbon/Paris protests (21 Nov event) → reframed to "LISBON - CAMP CLEARED" (REUTERS — police cleared the Rossio Square encampment at ~02:00 on Sun 22 Nov)
- #25 Ebola → ECDC (ECDC outbreak update, data to 17 Nov; ongoing outbreak)
- #26 Malta votes → reframed to "VALLETTA - LABOUR WINS" (AL JAZEERA — snap-election result announced Sun 22 Nov)
- #28 Lusaka cholera → ZAMBIA MONITOR (ZNPHI figures; latest update as at 20 Nov)
- #29 Nairobi Ruto → SUNDAY NATION (Kenya's Sunday Nation, 22 Nov front page on the 2027 race)
- #30 Mbabane child marriage → ESWATINI OBSERVER (Observer on the SADC child-marriage assembly; shown as "(OBSERVER)" in the image to fit the column)
- #32 Samoa Xavier → NWS (National Weather Service Pago Pago / JTWC advisories; storm approaching Samoa on Sun 22 Nov)
- #27 London NHS → kept "(SUNDAY POST)" — that IS the specific outlet (The Sunday Post, Scotland, 22 Nov front page verified).
- Display labels shortened where the ALSO column (max ~40 chars/line) required it: "(WASHINGTON POST)" → "(WASH POST)", "(ZAMBIA MONITOR)" → "(ZAM MONITOR)", "(ESWATINI OBSERVER)" → "(OBSERVER)"; headlines trimmed to fit: #24 "WASHINGTON - HEGSETH CURBS CANADA" → "DC - HEGSETH CURBS CANADA", #26 "LABOUR WINS AGAIN" → "LABOUR WINS", #29 "RUTO 2027 LOOMS" → "RUTO 2027". The `src` field in main.ts keeps each outlet's full name. Footer SOURCES line extended with BLOOMBERG, WASH POST, AL JAZEERA, ECDC, NWS.

**Weak spot 2 — Americas thickened (3 → 5).** Two weakest non-Americas one-liners swapped out for verified 22 Nov Americas stories (total stays 35):
- OUT #23 "ADDIS - ETHIOPIA-SUDAN ROW" (no clear 22 Nov development; tensions date to early-mid Nov) → IN #23 "BRASILIA - BOLSONARO IN ICU" (REUTERS — ex-president remains in ICU, stable, doctors weighing surgery; running story on Sun 22 Nov)
- OUT #24 "DAKAR - MIGRANT BOAT SINKS" (Yenne wreck was 17–18 Nov, reported 19 Nov; no 22 Nov development) → IN #24 "DC - HEGSETH CURBS CANADA" (WASHINGTON POST — secret memo restricting the US-Canada defence relationship, first reported Sun 22 Nov)
- Map pins moved accordingly (Brasilia −47.9/−15.8, Washington −77.0/38.9); de-collision re-run, pins legible (Washington #24 and New York #19 sit close but do not overlap).

## Hero (3)

| # | Story | Source |
|---|-------|--------|
| 1 | COP31 final text drops fossil fuels, no $120bn aid goal (Antalya) | Carbon Brief |
| 2 | Russia 186-drone barrage, 161 downed; Dymer 5-storey block falls, 14 missing, 9 evacuated (Kyiv) | Reuters |
| 3 | Iran begins rolling power cuts, blockade day 130 (Tehran) | RFE/RL / France 24 |

## Grid (10)

| # | Story | Source |
|---|-------|--------|
| 4 | Hong Kong Election Committee polls, record 98.79% turnout, 856 candidates for 723 seats | China Daily |
| 5 | South Korea education minister Choi Kyo-jin resigns over AI cheating / CSAT confusion, accepted same day | Korea JoongAng Daily |
| 6 | Two tankers hit near Strait of Hormuz, no injuries | France 24 |
| 7 | Alcaraz meets Zverev in ATP Finals title match, Turin, Sunday evening | USA Today |
| 8 | Pakistan FM hopes for US-Iran deal | Arab News |
| 9 | Nigeria boat toll rises to 24, 24 survivors (Bayelsa) | Reuters |
| 10 | Florida St. Johns River breaks 73-year record | AP / World in 90 Seconds briefing |
| 11 | Eisenkot invites Likud to coalition talks | Arab News |
| 12 | Lebanon's Aoun: end occupation, no arms outside state | Arab News |
| 13 | Marcos clarifies Trump farm / oil claim (Manila) | GMA |

## Also on Sunday 22 November (22 one-liners)

| # | Story | Source |
|---|-------|--------|
| 14 | West Bank — Palestinian killed by settlement guards | Arab News |
| 15 | Java — search for 36 missing after Fonusa Agung Mulia factory fire (Cikande) | Reuters |
| 16 | Manila — ICC asked to reject Duterte defence bid | GMA |
| 17 | Manila — Comelec sees 4M new voters for 2028 | GMA |
| 18 | Ifugao — Guterres warns terraces at risk | GMA |
| 19 | New York — Bitcoin near $59,000 | Bloomberg |
| 20 | California — Nvidia slides in AI correction | Reuters |
| 21 | Antalya — COP31 admits 1.5C overshoot | The Curtain |
| 22 | Lisbon — police clear protest camp at 02:00 Sun | Reuters |
| 23 | Brasilia — Bolsonaro remains in ICU, stable | Reuters |
| 24 | Washington — Hegseth memo curbs US-Canada defence ties | Washington Post |
| 25 | Kinshasa — Ebola outbreak in Congo | ECDC |
| 26 | Valletta — Labour wins Malta snap election | Al Jazeera |
| 27 | London — NHS failures | Sunday Post |
| 28 | Lusaka — detentions, cholera | Zambia Monitor |
| 29 | Nairobi — Ruto 2027 looms | Sunday Nation |
| 30 | Mbabane — child marriage | Eswatini Observer |
| 31 | Cardiff — Australia edges Wales 29-26 rugby | ESPN |
| 32 | Samoa — Cyclone Xavier fades | NWS |
| 33 | Bougainville — Australia / NZ rush El Niño aid | Post Courier |
| 34 | Wellington — India posts record 720/9 in NZ Test | EIN |
| 35 | Antalya — COP31 eases carbon market rules | CarrZee |

## Left out (other days' news, printed in the footer list)

- 21 Nov: EU–Indonesia trade deal signed (Reuters)
- 21 Nov: "El Chapo Isidro" captured in Sinaloa (Reuters)
- 21 Nov: Trump backs 10% credit card cap (AP)
- 21 Nov: Iraq Hartha power station fire kills 4 (Reuters)
- 21 Nov: LA / Long Beach port strike averted (Reuters)
- 21 Nov: Alcaraz beats Shelton in ATP semi-final (USA Today)
- 20 Nov: Bayer $7.25bn Roundup settlement approved (Reuters)
- 20 Nov: FBI probes NCIC database hack (CNN / AP)

## Borderline calls (included, with reason)

- #9 Nigeria boat toll: the accident was Fri 20 Nov, but the toll rising to 24 was first reported Sun 22 Nov (Reuters) — the *development* is 22 Nov news.
- #15 Indonesia factory fire: the fire was Sat 21 Nov, but the search for 36 missing was reported Sun 22 Nov (Reuters) — the *development* is 22 Nov news.

## Verification (v2)

- `node main.ts` runs cleanly; output written to `/output/entry.png` and `out/entry.png`.
- Two runs byte-identical (sha256 `1f92ff81ae422f6348e02aa7768aac0086c43913e8efc4ec467bc76112120de4`).
- Size 41,497 bytes (≤ 1 MiB), exactly 1024×1024 PNG.
- Rendered and viewed at full size and at 300×300: legible, no overlapping or cut-off text (v2 fix: five ALSO lines that overflowed with the longer outlet names were shortened to fit the ~40-char column), region strip fits, map pins readable (incl. new Brasilia #23 and Washington #24), no "(REPORTS)"/"(PAPERS)" labels remain — the only abbreviated display labels are "(WASH POST)", "(ZAM MONITOR)" and "(OBSERVER)", whose full outlet names are in the `src` field and this file.
