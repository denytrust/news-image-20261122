// news-image-20261122 — "The World in One Day: Sunday 22 November 2026"
// A self-contained Node program that draws one 1024x1024 front page in code:
// own PNG encoder, smooth DejaVu font atlas (font-atlas.bin, rendered locally
// with PIL and shipped as data), own drawn world map and icons.
// No network. Deterministic: same bytes every run.
// Run: node main.ts  ->  writes /output/entry.png and ./out/entry.png
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER: [number, number, number] = [250, 247, 239];
const INK: [number, number, number] = [20, 20, 20];
const NAVY: [number, number, number] = [18, 42, 76];
const RED: [number, number, number] = [176, 32, 32];
const TEAL: [number, number, number] = [14, 110, 110];
const GOLD: [number, number, number] = [176, 132, 32];
const CREAM: [number, number, number] = [244, 238, 218];
const GREY: [number, number, number] = [96, 96, 96];
const LINE: [number, number, number] = [200, 192, 172];
const WHITE: [number, number, number] = [255, 255, 255];
const LAND: [number, number, number] = [214, 206, 184];
const LANDLINE: [number, number, number] = [160, 150, 125];
const SEA: [number, number, number] = [233, 229, 211];
const NIGHT: [number, number, number] = [26, 42, 74];
const ORANGE: [number, number, number] = [240, 128, 32];
const YELLOW: [number, number, number] = [240, 192, 32];
const SKY: [number, number, number] = [42, 90, 138];
const DARK: [number, number, number] = [42, 42, 58];

type RGB = [number, number, number];

// ---------- smooth DejaVu font atlas (font-atlas.bin) ----------
// Glyphs rendered locally with PIL (DejaVu Serif Bold / DejaVu Sans /
// DejaVu Sans Bold), shipped as raw grayscale data. The sandbox has no
// font library, so main.ts reads this file and blits glyphs itself.
// Format: first line = JSON header {"v":1,"glyphs":{key:{o,w,h,adv,bx,by}}}
// (key = "<font>|<scale>|<char>", o = byte offset into the raw section),
// then raw grayscale bytes (one bitmap per glyph, row-major).
// "by" is measured from the CAP TOP, so an uppercase letter has by=0 and
// its cap top lands exactly on the y passed to drawText.
type AtlasFont = "serif" | "serifr" | "sans" | "sansb";
type GlyphMeta = { o: number; w: number; h: number; adv: number; bx: number; by: number };
const ATLAS_RAW: Buffer = (() => {
  try {
    return fs.readFileSync(new URL("./font-atlas.bin", import.meta.url));
  } catch {
    return fs.readFileSync("font-atlas.bin");
  }
})();
const ATLAS_NL = ATLAS_RAW.indexOf(0x0a);
const ATLAS_GLYPHS: Record<string, GlyphMeta> = (
  JSON.parse(ATLAS_RAW.subarray(0, ATLAS_NL).toString("utf8")) as {
    v: number;
    glyphs: Record<string, GlyphMeta>;
  }
).glyphs;
const ATLAS_DATA: Buffer = ATLAS_RAW.subarray(ATLAS_NL + 1);
function atlasGlyph(font: AtlasFont, scale: number, ch: string): GlyphMeta {
  return (
    ATLAS_GLYPHS[font + "|" + scale + "|" + ch] ||
    ATLAS_GLYPHS[font + "|" + scale + "|?"]
  );
}

// ---------- image buffer ----------
const buf = Buffer.alloc(W * H * 3);
function px(x: number, y: number, c: RGB): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}
// Alpha-blend a colour over the pixel: a = 0..255 coverage from the atlas.
function blendPx(x: number, y: number, c: RGB, a: number): void {
  if (a <= 0) return;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  if (a >= 255) {
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    return;
  }
  const inv = 255 - a;
  buf[i] = Math.round((c[0] * a + buf[i] * inv) / 255);
  buf[i + 1] = Math.round((c[1] * a + buf[i + 1] * inv) / 255);
  buf[i + 2] = Math.round((c[2] * a + buf[i + 2] * inv) / 255);
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    px(ax, ay, c);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ax += sx;
    }
    if (e2 < dx) {
      err += dx;
      ay += sy;
    }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB, fill: boolean): void {
  const rr = Math.round(r);
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      const d2 = dx * dx + dy * dy;
      if (fill ? d2 <= rr * rr : d2 <= rr * rr && d2 >= (rr - 1) * (rr - 1)) {
        px(cx + dx, cy + dy, c);
      }
    }
  }
}
function poly(points: [number, number][], c: RGB): void {
  // scanline fill of a simple polygon
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
  // outline
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    line(x1, y1, x2, y2, LANDLINE);
  }
}

// ---------- text (smooth DejaVu atlas) ----------
// Fonts: "serif" = DejaVu Serif Bold (headlines), "sans" = DejaVu Sans
// (body/captions), "sansb" = DejaVu Sans Bold (labels/kickers).
// textWidth sums the glyphs' proportional advances. drawText uppercases,
// like the old bitmap font did, so the atlas only needs A-Z + digits +
// punctuation. Glyphs are blitted with alpha blending (grayscale = coverage).
function textWidth(s: string, scale: number, font: AtlasFont = "sans"): number {
  const up = s.toUpperCase();
  let w = 0;
  for (const ch of up) w += atlasGlyph(font, scale, ch).adv;
  return w;
}
function drawTextF(x: number, y: number, s: string, scale: number, c: RGB, font: AtlasFont): void {
  const up = s.toUpperCase();
  let penX = x;
  for (const ch of up) {
    const g = atlasGlyph(font, scale, ch);
    if (g.w > 0 && g.h > 0) {
      const gx = penX + g.bx;
      const gy = y + g.by;
      for (let row = 0; row < g.h; row++) {
        const base = g.o + row * g.w;
        for (let col = 0; col < g.w; col++) {
          const a = ATLAS_DATA[base + col];
          if (a > 0) blendPx(gx + col, gy + row, c, a);
        }
      }
    }
    penX += g.adv;
  }
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB, bold: boolean): void {
  drawTextF(x, y, s, scale, c, bold ? "sansb" : "sans");
}
function drawTextBold(x: number, y: number, s: string, scale: number, c: RGB): void {
  drawTextF(x, y, s, scale, c, "sansb");
}
function drawSerif(x: number, y: number, s: string, scale: number, c: RGB): void {
  drawTextF(x, y, s, scale, c, "serif");
}
// Hero body copy: regular-weight DejaVu Serif, 10px cap (atlas "serifr", scale 1).
function drawSerifBody(x: number, y: number, s: string, c: RGB): void {
  drawTextF(x, y, s, 1, c, "serifr");
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB, bold: boolean): void {
  const w = textWidth(s, scale, bold ? "sansb" : "sans");
  drawTextF(cx - Math.floor(w / 2), y, s, scale, c, bold ? "sansb" : "sans");
}
function drawSerifCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  const w = textWidth(s, scale, "serif");
  drawTextF(cx - Math.floor(w / 2), y, s, scale, c, "serif");
}
function wrapText(s: string, maxW: number, scale: number, font: AtlasFont = "sans"): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale, font) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Wrap text into at most maxLines lines, balancing the line widths so no
// line is needlessly short (plain greedy wrap leaves orphans like a lone
// "missing." on the last line). Dynamic programming: dp[k][i] is the min
// raggedness cost of laying out the first i words in k lines; the cost of
// a non-final line is (maxW - lineW)^2, the final line costs 0. Falls back
// to greedy wrapText when the text cannot fit in maxLines at all.
function wrapBalanced(s: string, maxW: number, scale: number, font: AtlasFont, maxLines: number): string[] {
  const words = s.split(" ");
  const n = words.length;
  const sp = textWidth(" ", scale, font);
  const ww = words.map((w) => textWidth(w, scale, font));
  const segW = (i: number, j: number): number => {
    let t = 0;
    for (let k = i; k < j; k++) t += ww[k] + (k > i ? sp : 0);
    return t;
  };
  const INF = 1e15;
  const dp: number[][] = [];
  const bk: number[][] = [];
  for (let k = 0; k <= maxLines; k++) {
    dp.push(new Array(n + 1).fill(INF));
    bk.push(new Array(n + 1).fill(-1));
  }
  dp[0][0] = 0;
  for (let k = 1; k <= maxLines; k++) {
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j < i; j++) {
        if (dp[k - 1][j] === INF) continue;
        const lw = segW(j, i);
        if (lw > maxW) continue;
        const cost = i === n ? 0 : (maxW - lw) * (maxW - lw);
        const c = dp[k - 1][j] + cost;
        if (c < dp[k][i]) {
          dp[k][i] = c;
          bk[k][i] = j;
        }
      }
    }
  }
  let k = 1;
  while (k <= maxLines && dp[k][n] === INF) k++;
  if (k > maxLines) return wrapText(s, maxW, scale, font);
  const lines: string[] = [];
  let i = n;
  for (let kk = k; kk >= 1; kk--) {
    const j = bk[kk][i];
    lines.unshift(words.slice(j, i).join(" "));
    i = j;
  }
  return lines;
}
// Balance a headline into at most 2 lines with no orphan word.
function balanceLines(s: string, maxW: number, scale: number, font: AtlasFont = "serif"): string[] {
  const words = s.split(" ");
  if (words.length <= 1) return [s];
  if (textWidth(s, scale, font) <= maxW) return [s];
  let best: string[] = [s];
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (textWidth(a, scale, font) > maxW || textWidth(b, scale, font) > maxW) continue;
    const score = Math.abs(textWidth(a, scale, font) - textWidth(b, scale, font));
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

// ---------- PNG encoder ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- stories (all verified to Sunday 22 November 2026) ----------
// region: ASIA | MIDDLE EAST | EUROPE | AFRICA | AMERICAS | OCEANIA | GLOBAL
// kind: hero | grid | also
type Story = {
  n: number;
  region: string;
  kind: string;
  head: string;
  cap: string;
  src: string;
  lon: number;
  lat: number;
  icon: string;
  body?: string;
  sources?: string;
};
const STORIES: Story[] = [
  { n: 1, region: "GLOBAL", kind: "hero", head: "COP31 DROPS FOSSIL FUELS", cap: "Final text omits fuels, $120bn aid goal", src: "CARBON BRIEF", lon: 30.7, lat: 36.9, icon: "globe", body: "The text never mentions fossil fuels and sets no $120bn aid goal. It keeps 35% power by 2035 - and admits 1.5C will be overshot.", sources: "SOURCES: CARBON BRIEF • REUTERS • THE GUARDIAN" },
  { n: 2, region: "EUROPE", kind: "hero", head: "186 DRONES HIT KYIV", cap: "161 downed; flat block falls, 14 missing", src: "REUTERS", lon: 30.5, lat: 50.5, icon: "drone", body: "Russia fired 186 drones, 72 jet-powered. Air defence downed 161, but 18 sites were hit and a Dymer block fell, 14 missing.", sources: "SOURCES: REUTERS" },
  { n: 3, region: "MIDDLE EAST", kind: "hero", head: "IRAN RATIONS POWER", cap: "Rolling cuts begin as blockade hits day 130", src: "RFE/RL", lon: 51.4, lat: 35.7, icon: "bulb", body: "Rolling cuts of up to two hours a day begin as fuel runs short. Strikes on gas plants bite, and the US blockade hits day 130.", sources: "SOURCES: RFE/RL • FRANCE 24" },
  { n: 4, region: "ASIA", kind: "grid", head: "HONG KONG VOTES", cap: "Record 98.79% turnout; 856 vie for 723 seats", src: "CHINA DAILY", lon: 114.2, lat: 22.3, icon: "ballot" },
  { n: 5, region: "ASIA", kind: "grid", head: "MINISTER QUITS OVER AI", cap: "Korea education chief resigns after exam chaos", src: "KOREA JOONGANG", lon: 127.0, lat: 37.5, icon: "gavel" },
  { n: 6, region: "MIDDLE EAST", kind: "grid", head: "TANKERS HIT AT HORMUZ", cap: "Two tankers struck near strait; no injuries", src: "FRANCE 24", lon: 56.5, lat: 26.5, icon: "tanker" },
  { n: 7, region: "EUROPE", kind: "grid", head: "ALCARAZ FACES ZVEREV", cap: "ATP final tonight in Turin for maiden title", src: "USA TODAY", lon: 7.7, lat: 45.1, icon: "tennis" },
  { n: 8, region: "ASIA", kind: "grid", head: "PAKISTAN HOPES FOR DEAL", cap: "Foreign minister sees path to US-Iran pact", src: "ARAB NEWS", lon: 73.0, lat: 33.7, icon: "shake" },
  { n: 9, region: "AFRICA", kind: "grid", head: "BOAT TOLL RISES TO 24", cap: "Funeral boat capsized in Bayelsa; 24 saved", src: "REUTERS", lon: 6.0, lat: 4.8, icon: "boat" },
  { n: 10, region: "AMERICAS", kind: "grid", head: "FLORIDA RIVER RECORD", cap: "St. Johns breaks 73-year high after rains", src: "AP", lon: -80.7, lat: 28.4, icon: "wave" },
  { n: 11, region: "MIDDLE EAST", kind: "grid", head: "EISENKOT COURTS LIKUD", cap: "Ex-general invites Netanyahu party to talks", src: "ARAB NEWS", lon: 35.2, lat: 31.8, icon: "talks" },
  { n: 12, region: "MIDDLE EAST", kind: "grid", head: "AOUN: END OCCUPATION", cap: "Lebanon leader rejects arms outside state", src: "ARAB NEWS", lon: 35.5, lat: 33.9, icon: "flag" },
  { n: 13, region: "ASIA", kind: "grid", head: "MARCOS REBUTS TRUMP", cap: "Manila clarifies farm and oil deal claim", src: "GMA", lon: 121.0, lat: 14.6, icon: "mic" },
  { n: 14, region: "MIDDLE EAST", kind: "also", head: "WEST BANK - MAN KILLED", cap: "(ARAB NEWS)", src: "ARAB NEWS", lon: 35.4, lat: 32.2, icon: "" },
  { n: 15, region: "ASIA", kind: "also", head: "JAVA - 36 MISSING IN FIRE", cap: "(REUTERS)", src: "REUTERS", lon: 106.3, lat: -6.1, icon: "" },
  { n: 16, region: "ASIA", kind: "also", head: "MANILA - ICC REJECTS DUTERTE", cap: "(GMA)", src: "GMA", lon: 121.1, lat: 14.7, icon: "" },
  { n: 17, region: "ASIA", kind: "also", head: "MANILA - 4M NEW VOTERS 2028", cap: "(GMA)", src: "GMA", lon: 121.2, lat: 14.8, icon: "" },
  { n: 18, region: "ASIA", kind: "also", head: "IFUGAO - TERRACES AT RISK", cap: "(GMA)", src: "GMA", lon: 121.0, lat: 16.8, icon: "" },
  { n: 19, region: "AMERICAS", kind: "also", head: "NEW YORK - BITCOIN $59,000", cap: "(BLOOMBERG)", src: "BLOOMBERG", lon: -74.0, lat: 40.7, icon: "" },
  { n: 20, region: "AMERICAS", kind: "also", head: "CALIFORNIA - NVIDIA SLIDES", cap: "(REUTERS)", src: "REUTERS", lon: -121.0, lat: 37.4, icon: "" },
  { n: 21, region: "GLOBAL", kind: "also", head: "ANTALYA - 1.5C OVERSHOOT", cap: "(CURTAIN)", src: "THE CURTAIN", lon: 30.9, lat: 37.0, icon: "" },
  { n: 22, region: "EUROPE", kind: "also", head: "LISBON - CAMP CLEARED", cap: "(REUTERS)", src: "REUTERS", lon: -9.1, lat: 38.7, icon: "" },
  { n: 23, region: "AMERICAS", kind: "also", head: "BRASILIA - BOLSONARO IN ICU", cap: "(REUTERS)", src: "REUTERS", lon: -47.9, lat: -15.8, icon: "" },
  { n: 24, region: "AMERICAS", kind: "also", head: "DC - HEGSETH CURBS CANADA", cap: "(WASH POST)", src: "WASHINGTON POST", lon: -77.0, lat: 38.9, icon: "" },
  { n: 25, region: "AFRICA", kind: "also", head: "KINSHASA - EBOLA IN CONGO", cap: "(ECDC)", src: "ECDC", lon: 15.3, lat: -4.3, icon: "" },
  { n: 26, region: "EUROPE", kind: "also", head: "VALLETTA - LABOUR WINS", cap: "(AL JAZEERA)", src: "AL JAZEERA", lon: 14.4, lat: 35.9, icon: "" },
  { n: 27, region: "EUROPE", kind: "also", head: "LONDON - NHS FAILS", cap: "(SUNDAY POST)", src: "SUNDAY POST", lon: -0.1, lat: 51.5, icon: "" },
  { n: 28, region: "AFRICA", kind: "also", head: "LUSAKA - CHOLERA SPREADS", cap: "(ZAM MONITOR)", src: "ZAMBIA MONITOR", lon: 28.3, lat: -15.4, icon: "" },
  { n: 29, region: "AFRICA", kind: "also", head: "NAIROBI - RUTO 2027", cap: "(SUNDAY NATION)", src: "SUNDAY NATION", lon: 36.8, lat: -1.3, icon: "" },
  { n: 30, region: "AFRICA", kind: "also", head: "MBABANE - CHILD MARRIAGE", cap: "(OBSERVER)", src: "ESWATINI OBSERVER", lon: 31.4, lat: -26.3, icon: "" },
  { n: 31, region: "OCEANIA", kind: "also", head: "CARDIFF - AUS 29, WALES 26", cap: "(ESPN)", src: "ESPN", lon: -3.2, lat: 51.5, icon: "" },
  { n: 32, region: "OCEANIA", kind: "also", head: "SAMOA - XAVIER FADES", cap: "(NWS)", src: "NWS", lon: -172.0, lat: -13.8, icon: "" },
  { n: 33, region: "OCEANIA", kind: "also", head: "BOUGAINVILLE - AID RUSH", cap: "(COURIER)", src: "POST COURIER", lon: 155.0, lat: -6.0, icon: "" },
  { n: 34, region: "OCEANIA", kind: "also", head: "WELLINGTON - INDIA 720/9", cap: "(EIN)", src: "EIN", lon: 174.8, lat: -41.3, icon: "" },
  { n: 35, region: "GLOBAL", kind: "also", head: "ANTALYA - CARBON RULES", cap: "(CARRZEE)", src: "CARRZEE", lon: 30.8, lat: 36.8, icon: "" },
];

const REGIONS: [string, number][] = [
  ["ASIA", 8],
  ["MIDDLE EAST", 5],
  ["EUROPE", 5],
  ["AFRICA", 5],
  ["AMERICAS", 5],
  ["OCEANIA", 4],
  ["GLOBAL", 3],
];

const LEFT_OUT: [string, string][] = [
  ["21 NOV", "EU-INDONESIA TRADE DEAL SIGNED"],
  ["21 NOV", "EL CHAPO ISIDRO CAPTURED IN SINALOA"],
  ["21 NOV", "TRUMP BACKS 10% CREDIT CARD CAP"],
  ["21 NOV", "IRAQ POWER STATION FIRE KILLS 4"],
  ["21 NOV", "LA PORTS STRIKE AVERTED"],
  ["21 NOV", "ALCARAZ BEATS SHELTON IN SEMI-FINAL"],
  ["20 NOV", "BAYER $7.25BN ROUNDUP DEAL APPROVED"],
  ["20 NOV", "FBI PROBES NCIC DATABASE HACK"],
];

// ---------- hero scenes (drawn) ----------
function heroGlobe(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  // globe
  const cx = x + Math.floor(w * 0.36);
  const cy = y + Math.floor(h * 0.52);
  const r = Math.floor(h * 0.36);
  circle(cx, cy, r, [70, 130, 180], true);
  circle(cx, cy, r, WHITE, false);
  // land blobs on the globe
  circle(cx - Math.floor(r * 0.35), cy - Math.floor(r * 0.25), Math.floor(r * 0.28), [90, 160, 110], true);
  circle(cx + Math.floor(r * 0.4), cy + Math.floor(r * 0.15), Math.floor(r * 0.22), [90, 160, 110], true);
  circle(cx + Math.floor(r * 0.1), cy + Math.floor(r * 0.45), Math.floor(r * 0.18), [90, 160, 110], true);
  // thermometer
  const tx = x + Math.floor(w * 0.72);
  const ty = y + Math.floor(h * 0.16);
  fillRect(tx, ty, 12, Math.floor(h * 0.6), WHITE);
  fillRect(tx + 2, ty + Math.floor(h * 0.2), 8, Math.floor(h * 0.4), RED);
  circle(tx + 6, ty + Math.floor(h * 0.62), 11, RED, true);
  circle(tx + 6, ty + Math.floor(h * 0.62), 11, WHITE, false);
  // document with red slash (no fossil fuels)
  const dx = x + Math.floor(w * 0.82);
  const dy = y + Math.floor(h * 0.55);
  fillRect(dx, dy, 34, 44, CREAM);
  line(dx, dy, dx + 34, dy + 44, RED);
  line(dx + 34, dy, dx, dy + 44, RED);
  for (let i = 0; i < 3; i++) line(dx + 5, dy + 8 + i * 7, dx + 29, dy + 8 + i * 7, GREY);
}
function heroDrone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NIGHT);
  // stars
  const stars: [number, number][] = [[8, 8], [30, 20], [55, 6], [80, 26], [110, 10], [140, 22], [170, 8], [200, 18], [230, 6], [260, 20], [15, 40], [290, 40]];
  for (const [sx, sy] of stars) {
    px(x + sx, y + sy, WHITE);
    px(x + sx + 1, y + sy, WHITE);
  }
  // city skyline
  fillRect(x, y + h - 34, w, 34, DARK);
  const bld: [number, number, number][] = [[10, 22, 26], [45, 16, 30], [80, 26, 22], [115, 14, 34], [155, 22, 26], [195, 18, 30], [235, 24, 24], [270, 16, 28]];
  for (const [bx, bw, bh] of bld) {
    fillRect(x + bx, y + h - 34 - bh, bw, bh, [58, 58, 80]);
    fillRect(x + bx + 4, y + h - 34 - bh + 5, 4, 5, YELLOW);
    fillRect(x + bx + bw - 10, y + h - 34 - bh + 12, 4, 5, YELLOW);
  }
  // explosion starburst
  const ex = x + Math.floor(w * 0.62);
  const ey = y + Math.floor(h * 0.38);
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const r1 = 10 + (k % 3) * 8;
    line(ex, ey, ex + Math.round(Math.cos(a) * r1), ey + Math.round(Math.sin(a) * r1), ORANGE);
    line(ex, ey, ex + Math.round(Math.cos(a) * (r1 + 6)), ey + Math.round(Math.sin(a) * (r1 + 6)), YELLOW);
  }
  circle(ex, ey, 9, YELLOW, true);
  circle(ex, ey, 5, ORANGE, true);
  // drone quadcopter
  const qx = x + Math.floor(w * 0.2);
  const qy = y + Math.floor(h * 0.3);
  fillRect(qx - 8, qy - 3, 16, 6, WHITE);
  fillRect(qx - 3, qy - 8, 6, 16, WHITE);
  circle(qx - 10, qy - 8, 4, GREY, true);
  circle(qx + 10, qy - 8, 4, GREY, true);
  circle(qx - 10, qy + 8, 4, GREY, true);
  circle(qx + 10, qy + 8, 4, GREY, true);
  circle(qx, qy, 4, RED, true);
}
function heroBulb(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, DARK);
  // dark skyline
  fillRect(x, y + h - 30, w, 30, [20, 20, 30]);
  const bld: [number, number, number][] = [[12, 24, 24], [48, 18, 28], [84, 26, 20], [122, 16, 32], [160, 22, 24], [198, 18, 28], [236, 24, 22], [272, 16, 26]];
  for (const [bx, bw, bh] of bld) {
    fillRect(x + bx, y + h - 30 - bh, bw, bh, [38, 38, 52]);
  }
  // one lit window, rest dark
  fillRect(x + 52, y + h - 30 - 20, 5, 6, YELLOW);
  // big dim bulb with slash
  const cx = x + Math.floor(w * 0.5);
  const cy = y + Math.floor(h * 0.42);
  circle(cx, cy, 30, [120, 110, 60], true);
  circle(cx, cy, 30, [200, 190, 110], false);
  fillRect(cx - 8, cy + 28, 16, 8, GREY);
  line(cx - 8, cy + 38, cx + 8, cy + 38, GREY);
  line(cx - 34, cy - 34, cx + 34, cy + 34, RED);
  line(cx - 34, cy - 34, cx + 34, cy + 34, RED);
  // power plug
  const px0 = x + Math.floor(w * 0.82);
  const py0 = y + Math.floor(h * 0.62);
  fillRect(px0, py0, 22, 30, GREY);
  fillRect(px0 + 4, py0 - 10, 4, 10, WHITE);
  fillRect(px0 + 14, py0 - 10, 4, 10, WHITE);
}

// ---------- grid icons (small pictograms, drawn in a cream tile) ----------
function drawIcon(cx: number, cy: number, icon: string, c: RGB): void {
  switch (icon) {
    case "ballot":
      fillRect(cx - 12, cy - 6, 24, 18, WHITE);
      line(cx - 12, cy - 6, cx + 12, cy - 6, c);
      line(cx - 12, cy + 12, cx + 12, cy + 12, c);
      line(cx - 6, cy + 2, cx - 1, cy + 7, c);
      line(cx - 1, cy + 7, cx + 9, cy - 4, c);
      break;
    case "gavel":
      line(cx - 10, cy + 8, cx + 10, cy - 8, c);
      fillRect(cx - 12, cy - 12, 8, 6, c);
      fillRect(cx + 4, cy + 6, 8, 6, c);
      break;
    case "tanker":
      fillRect(cx - 14, cy - 4, 28, 10, c);
      fillRect(cx - 8, cy - 12, 8, 8, c);
      line(cx - 16, cy + 8, cx + 16, cy + 8, SKY);
      line(cx - 12, cy + 11, cx + 12, cy + 11, SKY);
      break;
    case "tennis":
      circle(cx, cy, 10, [180, 220, 80], true);
      circle(cx, cy, 10, c, false);
      line(cx - 8, cy - 5, cx - 2, cy + 8, c);
      line(cx + 8, cy - 5, cx + 2, cy + 8, c);
      break;
    case "shake":
      line(cx - 12, cy - 2, cx - 2, cy + 6, c);
      line(cx + 12, cy - 2, cx + 2, cy + 6, c);
      line(cx - 2, cy + 6, cx + 2, cy + 6, c);
      circle(cx - 12, cy - 4, 3, c, true);
      circle(cx + 12, cy - 4, 3, c, true);
      break;
    case "boat":
      line(cx - 14, cy, cx + 14, cy, c);
      line(cx - 10, cy, cx - 4, cy + 8, c);
      line(cx + 10, cy, cx + 4, cy + 8, c);
      line(cx - 4, cy + 8, cx + 4, cy + 8, c);
      line(cx, cy, cx, cy - 12, c);
      line(cx, cy - 12, cx + 10, cy - 4, c);
      break;
    case "wave":
      for (let i = -14; i <= 14; i += 2) {
        const yy = cy + Math.round(Math.sin(i / 4) * 4);
        px(cx + i, yy, c);
        px(cx + i, yy + 6, c);
      }
      break;
    case "talks":
      circle(cx - 7, cy - 6, 5, c, true);
      circle(cx + 7, cy - 6, 5, c, true);
      fillRect(cx - 12, cy + 2, 10, 8, c);
      fillRect(cx + 2, cy + 2, 10, 8, c);
      break;
    case "flag":
      line(cx - 8, cy - 12, cx - 8, cy + 12, c);
      line(cx - 8, cy - 12, cx + 10, cy - 8, c);
      line(cx + 10, cy - 8, cx - 8, cy - 4, c);
      break;
    case "mic":
      circle(cx, cy - 4, 7, c, true);
      line(cx - 5, cy + 4, cx - 5, cy + 10, c);
      line(cx + 5, cy + 4, cx + 5, cy + 10, c);
      line(cx - 5, cy + 10, cx + 5, cy + 10, c);
      break;
    case "globe":
      circle(cx, cy, 10, SKY, true);
      circle(cx - 3, cy - 3, 3, [90, 160, 110], true);
      circle(cx + 4, cy + 3, 2, [90, 160, 110], true);
      break;
    case "drone":
      fillRect(cx - 7, cy - 2, 14, 4, c);
      circle(cx - 9, cy - 6, 3, c, true);
      circle(cx + 9, cy - 6, 3, c, true);
      circle(cx - 9, cy + 6, 3, c, true);
      circle(cx + 9, cy + 6, 3, c, true);
      break;
    case "bulb":
      circle(cx, cy - 2, 8, YELLOW, true);
      fillRect(cx - 4, cy + 6, 8, 4, GREY);
      break;
    default:
      circle(cx, cy, 8, c, true);
  }
}

// ---------- world map ----------
const NA: [number, number][] = [[-168, 66], [-140, 70], [-120, 72], [-100, 73], [-80, 73], [-70, 62], [-55, 52], [-60, 47], [-70, 42], [-75, 35], [-80, 26], [-85, 30], [-90, 21], [-95, 19], [-105, 20], [-115, 30], [-125, 40], [-130, 50], [-150, 60], [-165, 60]];
const SA: [number, number][] = [[-80, 10], [-75, 5], [-60, 0], [-50, -5], [-35, -8], [-40, -20], [-50, -30], [-60, -40], [-70, -55], [-75, -40], [-70, -20], [-80, -5]];
const EU: [number, number][] = [[-10, 36], [-5, 44], [0, 50], [5, 55], [10, 58], [18, 56], [25, 60], [30, 65], [40, 68], [45, 65], [30, 55], [25, 50], [20, 45], [15, 40], [10, 38], [0, 36]];
const AF: [number, number][] = [[-15, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [10, -5], [5, 5], [-5, 5]];
const AS: [number, number][] = [[40, 68], [60, 70], [80, 73], [100, 77], [120, 73], [140, 72], [160, 70], [180, 66], [170, 60], [160, 55], [140, 50], [130, 42], [120, 38], [110, 20], [105, 10], [100, 5], [95, 15], [90, 22], [80, 8], [75, 20], [70, 25], [60, 25], [55, 28], [48, 30], [45, 35], [40, 40]];
const AU: [number, number][] = [[113, -22], [120, -15], [130, -12], [137, -12], [142, -11], [147, -19], [150, -23], [153, -27], [150, -37], [140, -38], [130, -32], [120, -34]];
const GL: [number, number][] = [[-55, 60], [-45, 60], [-40, 65], [-30, 68], [-20, 70], [-30, 76], [-50, 78], [-60, 75], [-58, 70]];
const JP: [number, number][] = [[130, 31], [135, 34], [140, 38], [141, 42], [144, 44], [140, 40], [135, 35]];
const ID: [number, number][] = [[95, 5], [100, 0], [105, -5], [110, -7], [115, -8], [120, -10], [125, -9], [130, -3], [135, -2], [140, -8], [138, -5], [130, 0], [120, 0], [110, 0]];
const UK: [number, number][] = [[-5, 50], [-3, 53], [-5, 56], [-2, 58], [0, 53], [1, 51]];
const CONTINENTS: [number, number][][] = [NA, SA, EU, AF, AS, AU, GL, JP, ID, UK];

// ---------- layout ----------
function badge(x: number, y: number, r: number, n: number, c: RGB): void {
  circle(x, y, r, c, true);
  circle(x, y, r, WHITE, false);
  const s = String(n);
  drawTextCentered(x, y - 3, s, 1, WHITE, true);
}
function kicker(x: number, y: number, s: string): void {
  drawTextBold(x, y, s, 1, RED);
}
function masthead(): void {
  drawTextCentered(W / 2, 6, "THE WORLD IN ONE DAY", 2, RED, true);
  drawSerifCentered(W / 2, 20, "SUNDAY 22 NOVEMBER 2026", 5, INK);
  drawTextCentered(W / 2, 58, "35 STORIES  •  EVERY CONTINENT  •  ALL FROM THIS ONE DAY", 1, GREY, false);
  line(20, 68, W - 20, 68, INK);
}
function regionStrip(): void {
  fillRect(20, 70, W - 40, 28, NAVY);
  const parts = REGIONS.map(([r, n]) => r + " " + n);
  const s = parts.join(" • ");
  drawTextCentered(W / 2, 76, s, 2, WHITE, true);
}
// v5: "THE DAY IN UTC" strip, one row under the region strip (as in the
// top entries). All times verified to Sunday 22 November 2026 UTC — see
// NOTES.md. Label bold yellow, times bold white, labels regular white.
const UTC_ITEMS: [string, string][] = [
  ["02:00", "LISBON CAMP CLEARED"],
  ["03:00", "COP31 OBJECTIONS CLOSE"],
  ["06:00", "161 OF 186 DRONES DOWNED"],
  ["10:00", "HK POLLS CLOSE 98.79%"],
  ["17:00", "ALCARAZ-ZVEREV FINAL"],
];
function utcStrip(): void {
  fillRect(20, 100, W - 40, 20, DARK);
  let x = 28;
  const y = 106;
  drawTextBold(x, y, "THE DAY IN UTC", 1, YELLOW);
  x += textWidth("THE DAY IN UTC", 1, "sansb") + 18;
  for (const [t, label] of UTC_ITEMS) {
    drawTextBold(x, y, t, 1, WHITE);
    x += textWidth(t, 1, "sansb") + 4;
    drawText(x, y, label, 1, WHITE, false);
    x += textWidth(label, 1, "sans") + 18;
  }
}
function heroPanel(s: Story, x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, WHITE);
  // border
  line(x, y, x + w, y, LINE);
  line(x, y + h, x + w, y + h, LINE);
  line(x, y, x, y + h, LINE);
  line(x + w, y, x + w, y + h, LINE);
  badge(x + 18, y + 16, 11, s.n, RED);
  kicker(x + 36, y + 10, s.region);
  const sx = x + 8;
  const sy = y + 30;
  const sw = w - 16;
  const sh = 72;
  if (s.icon === "globe") heroGlobe(sx, sy, sw, sh);
  else if (s.icon === "drone") heroDrone(sx, sy, sw, sh);
  else heroBulb(sx, sy, sw, sh);
  const lines = balanceLines(s.head, sw - 8, 3);
  const headY = sy + sh + 6;
  for (let i = 0; i < lines.length; i++) {
    drawSerif(x + 10, headY + i * 27, lines[i], 3, INK);
  }
  const headEnd = headY + (lines.length - 1) * 27 + 21;
  // v5: full body copy (regular serif, 10px cap, 13px advance = 1.3x),
  // balanced into at most 4 lines, then the sources line.
  const bodyLines = s.body ? wrapBalanced(s.body, sw - 8, 1, "serifr", 4) : [];
  const bodyY = headEnd + 4;
  for (let i = 0; i < bodyLines.length; i++) {
    drawSerifBody(x + 10, bodyY + i * 13, bodyLines[i], INK);
  }
  const bodyEnd = bodyLines.length ? bodyY + (bodyLines.length - 1) * 13 + 10 : bodyY;
  const srcY = Math.max(y + h - 14, bodyEnd + 4);
  drawText(x + 10, srcY, s.sources || s.src, 1, GREY, false);
}
function gridTile(s: Story, x: number, y: number, w: number, h: number, alt: boolean): void {
  fillRect(x, y, w, h, alt ? CREAM : WHITE);
  line(x, y, x + w, y, LINE);
  line(x, y + h, x + w, y + h, LINE);
  line(x, y, x, y + h, LINE);
  line(x + w, y, x + w, y + h, LINE);
  badge(x + 13, y + 13, 8, s.n, RED);
  kicker(x + 25, y + 9, s.region);
  // icon box, top-right
  fillRect(x + w - 38, y + 8, 30, 30, CREAM);
  line(x + w - 38, y + 8, x + w - 8, y + 8, LINE);
  line(x + w - 38, y + 38, x + w - 8, y + 38, LINE);
  line(x + w - 38, y + 8, x + w - 38, y + 38, LINE);
  line(x + w - 8, y + 8, x + w - 8, y + 38, LINE);
  drawIcon(x + w - 23, y + 23, s.icon, NAVY);
  const lines = balanceLines(s.head, w - 16, 2);
  const headY = y + 42;
  for (let i = 0; i < lines.length; i++) {
    drawSerif(x + 8, headY + i * 16, lines[i], 2, INK);
  }
  const headEnd = headY + (lines.length - 1) * 16 + 12;
  const caps = wrapText(s.cap, w - 16, 1);
  const capY = headEnd + 2;
  const capLines = caps.slice(0, 2);
  for (let i = 0; i < capLines.length; i++) {
    drawText(x + 8, capY + i * 9, capLines[i], 1, INK, false);
  }
  drawText(x + 8, y + h - 9, s.src, 1, GREY, false);
}

// map geometry
const MAPX = 20;
const MAPY = 576;
const MAPW = 480;
const MAPH = 190;
function project(lon: number, lat: number): [number, number] {
  return [MAPX + ((lon + 180) / 360) * MAPW, MAPY + ((90 - lat) / 180) * MAPH];
}
function drawMap(): void {
  fillRect(MAPX, MAPY, MAPW, MAPH, SEA);
  // graticule
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = project(lon, 0);
    line(x, MAPY, x, MAPY + MAPH, [222, 218, 198]);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat);
    line(MAPX, y, MAPX + MAPW, y, [222, 218, 198]);
  }
  for (const cont of CONTINENTS) {
    const pts: [number, number][] = cont.map(([lo, la]) => project(lo, la));
    poly(pts, LAND);
  }
  // pins with de-collision + leader lines
  type Pin = { n: number; gx: number; gy: number; x: number; y: number };
  const pins: Pin[] = STORIES.map((s) => {
    const [gx, gy] = project(s.lon, s.lat);
    return { n: s.n, gx, gy, x: gx, y: gy };
  });
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const min = 17;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
    for (const p of pins) {
      p.x = Math.max(MAPX + 8, Math.min(MAPX + MAPW - 8, p.x));
      p.y = Math.max(MAPY + 8, Math.min(MAPY + MAPH - 8, p.y));
    }
  }
  for (const p of pins) {
    const moved = Math.sqrt((p.x - p.gx) * (p.x - p.gx) + (p.y - p.gy) * (p.y - p.gy));
    if (moved > 3) {
      line(p.gx, p.gy, p.x, p.y, [150, 140, 115]);
      circle(p.gx, p.gy, 2, RED, true);
    }
  }
  for (const p of pins) {
    circle(p.x, p.y, 7, RED, true);
    circle(p.x, p.y, 7, WHITE, false);
    const s = String(p.n);
    drawTextCentered(p.x, p.y - 3, s, 1, WHITE, true);
  }
}
function keyNumbers(): void {
  const stats: [string, string][] = [
    ["186", "DRONES OVERNIGHT"],
    ["98.79%", "HONG KONG TURNOUT"],
    ["$120BN", "ADAPTATION AID DROPPED"],
  ];
  const bw = 150;
  const gap = 15;
  for (let i = 0; i < stats.length; i++) {
    const x = MAPX + i * (bw + gap);
    const y = 766;
    fillRect(x, y, bw, 52, WHITE);
    line(x, y, x + bw, y, LINE);
    line(x, y + 52, x + bw, y + 52, LINE);
    line(x, y, x, y + 52, LINE);
    line(x + bw, y, x + bw, y + 52, LINE);
    drawSerifCentered(x + bw / 2, y + 8, stats[i][0], 3, NAVY);
    drawTextCentered(x + bw / 2, y + 38, stats[i][1], 1, GREY, false);
  }
}
function leftOutList(): void {
  drawTextBold(MAPX, 826, "LEFT OUT AS OTHER DAYS' NEWS", 2, RED);
  let y = 846;
  for (const [d, t] of LEFT_OUT) {
    drawTextBold(MAPX, y, d, 1, GREY);
    drawText(MAPX + 52, y, t, 1, INK, false);
    y += 11;
  }
}
function alsoList(): void {
  const x0 = 520;
  const x1 = W - 20;
  drawTextBold(x0, 552, "ALSO ON SUNDAY 22 NOVEMBER 2026", 2, NAVY);
  const items = STORIES.filter((s) => s.kind === "also");
  let y = 576;
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (i % 2 === 0) fillRect(x0 - 4, y - 2, x1 - x0 + 8, 17, CREAM);
    const lineText = s.n + " " + s.head + " " + s.cap;
    drawText(x0, y, lineText, 2, INK, false);
    y += 17;
  }
}
function footer(): void {
  fillRect(20, 951, W - 40, 2, INK);
  drawTextBold(20, 959, "DATE CHECK ✓", 2, RED);
  drawText(20 + textWidth("DATE CHECK ✓", 2, "sansb") + 12, 959, "EVERY STORY IS FROM SUNDAY 22 NOVEMBER 2026", 2, INK, false);
  drawText(20, 979, "CLAIMS ARE ATTRIBUTED, NOT STATED AS FACT  •  PICTURES AND MAP: ORIGINAL, DRAWN IN CODE", 1, GREY, false);
  drawText(20, 991, "SOURCES: REUTERS, AP, AFP, CARBON BRIEF, FRANCE 24, ARAB NEWS, GMA, CHINA DAILY, KOREA JOONGANG, USA TODAY, ESPN, RFE/RL, BLOOMBERG, WASH POST, AL JAZEERA, ECDC, NWS", 1, GREY, false);
  drawTextCentered(W / 2, 1007, "35 STORIES  •  7 REGIONS  •  2026-11-22", 1, GREY, false);
}
function main(): void {
  fillRect(0, 0, W, H, PAPER);
  masthead();
  regionStrip();
  utcStrip();
  const heroes = STORIES.filter((s) => s.kind === "hero");
  const heroW = 320;
  const heroGap = 12;
  for (let i = 0; i < heroes.length; i++) {
    heroPanel(heroes[i], 20 + i * (heroW + heroGap), 122, heroW, 228);
  }
  const grid = STORIES.filter((s) => s.kind === "grid");
  const tileW = 188;
  const tileGap = 11;
  for (let i = 0; i < grid.length; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    gridTile(grid[i], 20 + col * (tileW + tileGap), 350 + row * 100, tileW, 100, i % 2 === 1);
  }
  drawTextBold(MAPX, 552, "WHERE IT HAPPENED", 2, NAVY);
  drawMap();
  keyNumbers();
  leftOutList();
  alsoList();
  footer();
  const png = encodePNG();
  fs.mkdirSync("/output", { recursive: true });
  fs.writeFileSync("/output/entry.png", png);
  fs.mkdirSync("out", { recursive: true });
  fs.writeFileSync("out/entry.png", png);
  console.log("wrote", png.length, "bytes");
}
main();
