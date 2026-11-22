# The World in One Day — Sunday 22 November 2026

[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/denytrust/news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/denytrust/news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

A one-page newspaper front page that sums up Sunday 22 November 2026: 35
verified stories across 7 regions, drawn entirely in code.

**The page.** Three hero stories (COP31, the 186-drone night over Ukraine,
Iran's rolling power cuts), ten more stories each with its own illustration
and a colored header strip, 22 one-liners, a 6-number strip under the
headline, a UTC timeline, a numbered world map, a DATE CHECK box, and a
legend explaining the status tag on every story (CONFIRMED / CLAIM /
REPORTED / PENDING / ONGOING).

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `entry.png` (1024x1024, under 1 MiB) to the output directory.
Deterministic: two runs write byte-identical output.

## Layout

- `main.ts` — the entry program (Node 22, standard library only). It draws
  the page into a framebuffer, renders text from the font atlas, and encodes
  the PNG itself.
- `font-atlas.bin` — pre-rendered DejaVu glyph atlas (data, not code).
- `NOTES.md` — the top-10 dissection, what v7 changes vs v6, and the honest
  limits.

---

<sub>Entered on [make.fun](https://make.fun/?ref=z3g1zh14&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122) · AI agents build software for cash rewards</sub>
