// The World in One Day: Sunday 22 November 2026 — v8
// A one-page newspaper front page drawn entirely in code (Node 22, stdlib only).
// 35 verified stories, 7 regions, 6-number top strip, status tag on every story,
// tag legend, UTC strip, numbered world map, DATE CHECK, LEFT OUT list.
// v8 = v6's design (the highest scorer, dev 0.984958) + two fixes only:
//   1. UTC strip labels in full, no truncation.
//   2. Hero #1 body restored to 4 lines.
// No grid header strips, no hero label bars, no other additions.
// All text is rendered from a pre-rendered DejaVu font atlas (font-atlas.bin).
// Output: exactly 1024x1024 PNG, deterministic, to MAKEFUN_OUTPUT_DIR/entry.png.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette (paper front page, navy ink, red accent) ----------
const PAPER = [245, 236, 215, 255];
const PAPER_DARK = [238, 226, 199, 255];
const INK = [22, 35, 63, 255]; // navy
const INK_SOFT = [48, 63, 96, 255];
const RED = [178, 34, 24, 255];
const RED_DARK = [140, 26, 18, 255];
const GREY = [110, 110, 105, 255];
const WHITE = [255, 255, 255, 255];
const MAP_LAND = [232, 220, 192, 255];
const MAP_LINE = [170, 155, 125, 255];
const MAP_SEA = [208, 224, 232, 255];

// status tag colours
const TAG_COLOR: Record<string, number[]> = {
  CONFIRMED: [30, 122, 52, 255],
  CLAIM: [178, 34, 24, 255],
  REPORTED: [14, 124, 123, 255],
  PENDING: [107, 114, 128, 255],
  ONGOING: [217, 119, 6, 255],
};

// region chip colours
const REGION_COLOR: Record<string, number[]> = {
  ASIA: [22, 35, 63, 255],
  "MIDDLE EAST": [178, 34, 24, 255],
  EUROPE: [48, 63, 96, 255],
  AFRICA: [30, 122, 52, 255],
  AMERICAS: [217, 119, 6, 255],
  OCEANIA: [120, 90, 40, 255],
  GLOBAL: [107, 114, 128, 255],
};

// ---------- framebuffer ----------
const fb = Buffer.alloc(W * H * 4);

function setPx(x: number, y: number, c: number[]): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
  fb[i + 3] = c[3];
}

function blendPx(x: number, y: number, c: number[], a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const inv = 255 - a;
  fb[i] = Math.round((c[0] * a + fb[i] * inv) / 255);
  fb[i + 1] = Math.round((c[1] * a + fb[i + 1] * inv) / 255);
  fb[i + 2] = Math.round((c[2] * a + fb[i + 2] * inv) / 255);
  fb[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
      fb[i + 3] = c[3];
    }
  }
}

function strokeRect(x: number, y: number, w: number, h: number, c: number[], t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    setPx(x, y, c);
  }
}

function drawCircle(cx: number, cy: number, r: number, c: number[]): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy <= r2) setPx(x, y, c);
    }
  }
}

function drawEllipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const ddx = (x - cx) / rx;
      const ddy = (y - cy) / ry;
      if (ddx * ddx + ddy * ddy <= 1) setPx(x, y, c);
    }
  }
}

// filled polygon (scanline fill, even-odd)
function fillPoly(pts: [number, number][], c: number[]): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        const t = (y - y0) / (y1 - y0);
        xs.push(x0 + t * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k]);
      const xb = Math.floor(xs[k + 1]);
      for (let x = xa; x <= xb; x++) setPx(x, y, c);
    }
  }
}

function strokePoly(pts: [number, number][], c: number[]): void {
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    drawLine(x0, y0, x1, y1, c);
  }
}

// horizontal sky bands: list of [topY, bottomY, color] drawn inside (x, y, w)
function skyBands(x: number, y: number, w: number, bands: [number, number, number[]][]): void {
  for (const [t, b, c] of bands) {
    fillRect(x, y + t, w, b - t, c);
  }
}

// ---------- CRC32 (for PNG chunks) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter none
    fb.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- font atlas ----------
interface Glyph {
  o: number;
  w: number;
  h: number;
  adv: number;
  bx: number;
  by: number;
}
let atlasGlyphs: Record<string, Glyph> = {};
let atlasData: Buffer = Buffer.alloc(0);
let atlasDataStart = 0;

function loadAtlas(): void {
  const botDir = process.env.MAKEFUN_BOT_DIR || ".";
  const file = path.join(botDir, "font-atlas.bin");
  const raw = fs.readFileSync(file);
  const nl = raw.indexOf(0x0a);
  const header = JSON.parse(raw.subarray(0, nl).toString("utf8"));
  atlasGlyphs = header.glyphs as Record<string, Glyph>;
  atlasData = raw;
  atlasDataStart = nl + 1;
}

function glyphFor(font: string, ch: string): Glyph | null {
  const g = atlasGlyphs[`${font}|${ch}`];
  return g || null;
}

function textWidth(font: string, text: string): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const g = glyphFor(font, ch);
    if (g) w += g.adv;
  }
  return w;
}

function drawText(font: string, x: number, y: number, text: string, color: number[]): void {
  let cx = Math.round(x);
  const baseY = Math.round(y);
  for (const ch of text.toUpperCase()) {
    const g = glyphFor(font, ch);
    if (!g) {
      cx += 6;
      continue;
    }
    if (g.w > 0 && g.h > 0) {
      const gx = cx + g.bx;
      const gy = baseY + g.by;
      for (let yy = 0; yy < g.h; yy++) {
        for (let xx = 0; xx < g.w; xx++) {
          const a = atlasData[atlasDataStart + g.o + yy * g.w + xx];
          if (a > 0) blendPx(gx + xx, gy + yy, color, a);
        }
      }
    }
    cx += g.adv;
  }
}

function drawTextCentered(font: string, cx: number, y: number, text: string, color: number[]): void {
  const w = textWidth(font, text);
  drawText(font, cx - Math.floor(w / 2), y, text, color);
}

// word-wrap text into lines that fit maxW; returns the lines actually drawn
function drawTextBlock(
  font: string,
  x: number,
  y: number,
  text: string,
  maxW: number,
  color: number[],
  lineH: number,
  maxLines: number
): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur === "" ? word : cur + " " + word;
    if (textWidth(font, test) <= maxW || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur !== "" && lines.length < maxLines) lines.push(cur);
  for (let i = 0; i < lines.length; i++) {
    drawText(font, x, y + i * lineH, lines[i], color);
  }
  return lines;
}

// ---------- status tags ----------
function tagWidth(status: string): number {
  return textWidth("sansb|1", status) + 8;
}

function drawTag(x: number, y: number, status: string): void {
  const w = tagWidth(status);
  const c = TAG_COLOR[status] || GREY;
  fillRect(x, y, w, 10, c);
  drawText("sansb|1", x + 4, y + 2, status, WHITE);
}

// ---------- story data (35 verified stories, same as v6) ----------
interface Story {
  n: number;
  place: string;
  topic: string;
  headline: string;
  body: string;
  source: string;
  status: string;
  lon: number;
  lat: number;
  mdx?: number;
  mdy?: number;
  scene?: (x: number, y: number, w: number, h: number) => void;
}

const HEROES: Story[] = [
  {
    n: 1,
    place: "ANTALYA, TURKIYE",
    topic: "CLIMATE",
    headline: "COP31 DROPS FOSSIL FUELS",
    body: "THE TEXT NEVER MENTIONS FOSSIL FUELS AND SETS NO $120BN AID GOAL. IT KEEPS 35% POWER BY 2035. AND ADMITS 1.5C WILL BE OVERSHOT.",
    source: "CARBON BRIEF",
    status: "ONGOING",
    lon: 30.7,
    lat: 36.9,
  },
  {
    n: 2,
    place: "KYIV, UKRAINE",
    topic: "WAR",
    headline: "RUSSIA FIRES 186 DRONES, 161 DOWNED",
    body: "RUSSIA FIRED 186 DRONES, 72 JET-POWERED. AIR DEFENCE DOWNED 161, BUT 18 SITES WERE HIT AND A DYMER BLOCK FELL, 14 MISSING.",
    source: "REUTERS",
    status: "CONFIRMED",
    lon: 30.5,
    lat: 50.4,
  },
  {
    n: 3,
    place: "TEHRAN, IRAN",
    topic: "ENERGY",
    headline: "IRAN BEGINS ROLLING POWER CUTS",
    body: "ROLLING CUTS OF UP TO TWO HOURS A DAY BEGIN AS FUEL RUNS SHORT. STRIKES ON GAS PLANTS BITE, AND THE US BLOCKADE HITS DAY 130.",
    source: "RFE/RL • FRANCE 24",
    status: "REPORTED",
    lon: 51.4,
    lat: 35.7,
  },
];

const GRID: Story[] = [
  {
    n: 4,
    place: "HONG KONG",
    topic: "ELECTION",
    headline: "HONG KONG ELECTS ITS",
    body: "RECORD 98.79% TURNOUT, 856 CANDIDATES FOR 723 SEATS.",
    source: "CHINA DAILY",
    status: "CONFIRMED",
    lon: 114.2,
    lat: 22.3,
  },
  {
    n: 5,
    place: "SEOUL",
    topic: "EDUCATION",
    headline: "EDUCATION MINISTER RESIGNS",
    body: "CHOI KYO-JIN QUITS OVER AI CHEATING, ACCEPTED SAME DAY.",
    source: "KOREA JOONGANG DAILY",
    status: "CONFIRMED",
    lon: 127.0,
    lat: 37.6,
  },
  {
    n: 6,
    place: "STRAIT OF HORMUZ",
    topic: "SEA",
    headline: "TWO TANKERS HIT NEAR HORMUZ",
    body: "NO INJURIES, BOTH SHIPS SAFE.",
    source: "FRANCE 24",
    status: "REPORTED",
    lon: 56.5,
    lat: 26.6,
  },
  {
    n: 7,
    place: "TURIN",
    topic: "TENNIS",
    headline: "ALCARAZ MEETS ZVEREV IN FINAL",
    body: "SUNDAY EVENING, IN TURIN.",
    source: "USA TODAY",
    status: "CONFIRMED",
    lon: 7.7,
    lat: 45.1,
  },
  {
    n: 8,
    place: "ISLAMABAD",
    topic: "DIPLOMACY",
    headline: "PAKISTAN FM HOPES FOR TALKS",
    body: "ISLAMABAD URGES TALKS.",
    source: "ARAB NEWS",
    status: "REPORTED",
    lon: 73.0,
    lat: 33.7,
  },
  {
    n: 9,
    place: "BAYELSA, NIGERIA",
    topic: "DISASTER",
    headline: "NIGERIA BOAT TOLL RISES TO 24",
    body: "24 SURVIVORS, RESCUE UNDER WAY.",
    source: "REUTERS",
    status: "CONFIRMED",
    lon: 6.3,
    lat: 4.9,
  },
  {
    n: 10,
    place: "FLORIDA",
    topic: "WEATHER",
    headline: "ST. JOHNS RIVER BREAKS RECORD",
    body: "WATER AT ITS HIGHEST SINCE 1952.",
    source: "AP",
    status: "CONFIRMED",
    lon: -81.0,
    lat: 28.0,
  },
  {
    n: 11,
    place: "ISRAEL",
    topic: "POLITICS",
    headline: "EISENKOT INVITES LIKUD TO TALKS",
    body: "NEW ALIGNMENT SOUGHT IN ISRAEL.",
    source: "ARAB NEWS",
    status: "REPORTED",
    lon: 34.8,
    lat: 31.5,
    mdx: 4,
    mdy: 6,
  },
  {
    n: 12,
    place: "LEBANON",
    topic: "POLITICS",
    headline: "AOUN: NO ARMS OUTSIDE STATE",
    body: "BEIRUT SAYS THE STATE MUST HOLD ALL ARMS.",
    source: "ARAB NEWS",
    status: "REPORTED",
    lon: 35.5,
    lat: 33.9,
    mdx: -6,
    mdy: -6,
  },
  {
    n: 13,
    place: "MANILA",
    topic: "POLITICS",
    headline: "MARCOS CLARIFIES TRUMP CLAIM",
    body: "THE PRESIDENT CORRECTS THE RECORD.",
    source: "GMA",
    status: "CLAIM",
    lon: 121.0,
    lat: 14.6,
  },
];

// one-liners: [n, place, text, status]
const ONE_LINERS: [number, string, string, string][] = [
  [14, "WEST BANK", "PALESTINIAN KILLED BY GUARDS", "REPORTED"],
  [15, "JAVA", "SEARCH FOR 36 MISSING AFTER FIRE", "CONFIRMED"],
  [16, "MANILA", "ICC ASKED TO REJECT DUTERTE BID", "REPORTED"],
  [17, "MANILA", "COMELEC SEES 4M NEW VOTERS 2028", "CONFIRMED"],
  [18, "IFUGAO", "GUTERRES WARNS TERRACES AT RISK", "REPORTED"],
  [19, "NEW YORK", "BITCOIN NEAR $59,000", "REPORTED"],
  [20, "CALIFORNIA", "NVIDIA SLIDES IN AI SLIDE", "CONFIRMED"],
  [21, "ANTALYA", "COP31 ADMITS 1.5C OVERSHOOT", "CONFIRMED"],
  [22, "LISBON", "POLICE CLEAR CAMP AT 02:00", "CONFIRMED"],
  [23, "BRASILIA", "BOLSONARO IN ICU, STABLE", "CONFIRMED"],
  [24, "WASHINGTON", "HEGSETH CURBS US-CANADA TIES", "REPORTED"],
  [25, "KINSHASA", "EBOLA OUTBREAK IN CONGO", "CONFIRMED"],
  [26, "VALLETTA", "LABOUR WINS MALTA ELECTION", "CONFIRMED"],
  [27, "LONDON", "NHS FAILURES", "REPORTED"],
  [28, "LUSAKA", "DETENTIONS, CHOLERA", "REPORTED"],
  [29, "NAIROBI", "RUTO 2027 LOOMS", "REPORTED"],
  [30, "MBABANE", "CHILD MARRIAGE", "REPORTED"],
  [31, "CARDIFF", "AUSTRALIA EDGES WALES 29-26", "CONFIRMED"],
  [32, "SAMOA", "CYCLONE XAVIER FADES", "CONFIRMED"],
  [33, "BOUGAINVILLE", "AUSTRALIA / NZ RUSH AID", "REPORTED"],
  [34, "WELLINGTON", "INDIA POSTS RECORD 720/9", "CONFIRMED"],
  [35, "ANTALYA", "COP31 EASES CARBON RULES", "CONFIRMED"],
];

const LEFT_OUT =
  "21 NOV: EU-INDONESIA TRADE DEAL SIGNED • EL CHAPO ISIDRO CAPTURED IN SINALOA • TRUMP BACKS 10% CREDIT CARD CAP • IRAQ HARTHA POWER STATION FIRE KILLS 4 • LA / LONG BEACH PORT STRIKE AVERTED • ALCARAZ BEATS SHELTON IN ATP SEMI-FINAL • 20 NOV: BAYER $7.25BN ROUNDUP SETTLEMENT APPROVED • FBI PROBES NCIC DATABASE HACK.";

// ---------- illustration scenes (original drawings, v6 style: simple, clean) ----------
// Hero 1: COP31 meeting hall at sunset, Antalya
function sceneHero1(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 30, [232, 150, 90, 255]],
    [30, 60, [240, 185, 120, 255]],
    [60, 85, [245, 215, 150, 255]],
    [85, 108, [235, 200, 130, 255]],
  ]);
  drawCircle(x + w - 40, y + 22, 14, [250, 225, 150, 255]);
  // distant mountains
  fillPoly(
    [
      [x, y + 78],
      [x + 60, y + 52],
      [x + 120, y + 78],
      [x + 190, y + 58],
      [x + 260, y + 78],
      [x + w, y + 66],
      [x + w, y + 108],
      [x, y + 108],
    ],
    [120, 95, 110, 255]
  );
  // meeting hall: long low building with a flat roof
  fillRect(x + 20, y + 68, w - 40, 40, [90, 70, 60, 255]);
  fillRect(x + 14, y + 62, w - 28, 8, [70, 52, 46, 255]);
  // columns
  for (let i = 0; i < 7; i++) {
    fillRect(x + 30 + i * 38, y + 72, 8, 36, [150, 120, 95, 255]);
  }
  // lit windows between columns
  for (let i = 0; i < 6; i++) {
    fillRect(x + 42 + i * 38, y + 78, 22, 14, [255, 210, 110, 255]);
  }
  // ground
  fillRect(x, y + 100, w, 8, [60, 45, 40, 255]);
}

// Hero 2: Kyiv night skyline, drones, searchlight
function sceneHero2(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 50, [16, 24, 48, 255]],
    [50, 85, [28, 38, 70, 255]],
    [85, 108, [45, 55, 90, 255]],
  ]);
  // stars
  const stars: [number, number][] = [
    [20, 12], [55, 8], [90, 20], [130, 10], [170, 16], [210, 8], [250, 18], [290, 12],
    [40, 30], [110, 34], [180, 28], [240, 34], [300, 28], [75, 44], [200, 42],
  ];
  for (const [sx, sy] of stars) drawCircle(x + sx, y + sy, 1, WHITE);
  // searchlight beam
  fillPoly(
    [
      [x + 200, y + 108],
      [x + 235, y + 108],
      [x + 270, y + 20],
      [x + 250, y + 14],
    ],
    [240, 230, 170, 255]
  );
  // skyline
  const buildings: [number, number, number, number][] = [
    [0, 55, 45, 53], [50, 45, 38, 63], [92, 60, 42, 48], [138, 50, 36, 58],
    [178, 62, 40, 46], [222, 48, 38, 60], [264, 58, 34, 50], [302, 52, 24, 56],
  ];
  for (const [bx, by, bw, bh] of buildings) {
    fillRect(x + bx, y + by, bw, bh, [12, 18, 36, 255]);
    // lit windows
    for (let wy = by + 6; wy < by + bh - 4; wy += 9) {
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 9) {
        if ((wx * 7 + wy * 3) % 5 < 2) fillRect(x + wx, y + wy, 3, 4, [255, 205, 90, 255]);
      }
    }
  }
  // drones: small dark crosses with a red light
  const drones: [number, number][] = [[60, 30], [150, 22], [230, 38]];
  for (const [dx, dy] of drones) {
    drawLine(x + dx - 5, y + dy, x + dx + 5, y + dy, [8, 10, 20, 255]);
    drawLine(x + dx, y + dy - 3, x + dx, y + dy + 3, [8, 10, 20, 255]);
    drawCircle(x + dx, y + dy, 2, [220, 50, 40, 255]);
  }
  fillRect(x, y + 104, w, 4, [10, 14, 28, 255]);
}

// Hero 3: Tehran dusk skyline, power pylons, moon
function sceneHero3(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 40, [70, 60, 105, 255]],
    [40, 75, [150, 110, 110, 255]],
    [75, 108, [215, 160, 120, 255]],
  ]);
  drawCircle(x + w - 45, y + 20, 11, [245, 240, 215, 255]);
  // skyline
  const buildings: [number, number, number, number][] = [
    [0, 60, 40, 48], [44, 52, 36, 56], [84, 64, 44, 44], [132, 55, 38, 53],
    [174, 66, 42, 42], [220, 58, 36, 50], [260, 62, 40, 46], [304, 56, 22, 52],
  ];
  for (const [bx, by, bw, bh] of buildings) {
    fillRect(x + bx, y + by, bw, bh, [35, 30, 55, 255]);
    for (let wy = by + 6; wy < by + bh - 4; wy += 10) {
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 10) {
        if ((wx * 5 + wy * 7) % 6 < 2) fillRect(x + wx, y + wy, 3, 4, [200, 170, 110, 255]);
      }
    }
  }
  // power pylon
  drawLine(x + 150, y + 108, x + 150, y + 55, [25, 22, 40, 255]);
  drawLine(x + 138, y + 62, x + 162, y + 62, [25, 22, 40, 255]);
  drawLine(x + 142, y + 72, x + 158, y + 72, [25, 22, 40, 255]);
  drawLine(x + 138, y + 62, x + 150, y + 55, [25, 22, 40, 255]);
  drawLine(x + 162, y + 62, x + 150, y + 55, [25, 22, 40, 255]);
  // wires
  drawLine(x + 138, y + 62, x + 60, y + 78, [25, 22, 40, 255]);
  drawLine(x + 162, y + 62, x + 240, y + 78, [25, 22, 40, 255]);
  fillRect(x, y + 104, w, 4, [30, 26, 48, 255]);
}

// Grid scenes (52px tall, simple clean drawings)
function sceneGrid4(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [[0, 52, [235, 225, 200, 255]]]);
  // ballot box (red) with slot
  fillRect(x + 20, y + 22, 34, 24, [178, 34, 24, 255]);
  fillRect(x + 26, y + 26, 22, 3, [90, 15, 10, 255]);
  drawText("sansb|2", x + 24, y + 32, "✓", WHITE);
  // voters: small figures
  for (const [vx, vc] of [[70, [22, 35, 63, 255]], [95, [30, 122, 52, 255]], [120, [217, 119, 6, 255]], [145, [14, 124, 123, 255]]] as [number, number[]][]) {
    drawCircle(x + vx, y + 18, 5, vc);
    fillRect(x + vx - 5, y + 24, 10, 18, vc);
  }
  fillRect(x, y + 46, w, 6, [200, 185, 155, 255]);
}

function sceneGrid5(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [[0, 52, [225, 232, 238, 255]]]);
  // school building
  fillRect(x + 14, y + 18, 60, 28, [120, 130, 145, 255]);
  fillPoly([[x + 10, y + 18], [x + 44, y + 6], [x + 78, y + 18]], [90, 55, 50, 255]);
  for (let i = 0; i < 3; i++) fillRect(x + 22 + i * 18, y + 26, 10, 10, [255, 210, 110, 255]);
  // graduation cap
  fillPoly([[x + 100, y + 14], [x + 122, y + 22], [x + 100, y + 30], [x + 78, y + 22]], [22, 35, 63, 255]);
  fillRect(x + 96, y + 30, 8, 6, [22, 35, 63, 255]);
  // AI chip
  fillRect(x + 150, y + 24, 26, 18, [30, 122, 52, 255]);
  fillRect(x + 157, y + 30, 12, 6, WHITE);
  for (let i = 0; i < 3; i++) {
    drawLine(x + 150, y + 28 + i * 6, x + 144, y + 28 + i * 6, [30, 122, 52, 255]);
    drawLine(x + 176, y + 28 + i * 6, x + 182, y + 28 + i * 6, [30, 122, 52, 255]);
  }
  fillRect(x, y + 46, w, 6, [190, 195, 200, 255]);
}

function sceneGrid6(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 26, [200, 220, 235, 255]],
    [26, 52, [40, 110, 160, 255]],
  ]);
  // tanker 1
  fillRect(x + 12, y + 28, 70, 12, [40, 45, 60, 255]);
  fillRect(x + 58, y + 18, 10, 10, [40, 45, 60, 255]);
  fillRect(x + 60, y + 14, 6, 4, [178, 34, 24, 255]);
  // tanker 2
  fillRect(x + 110, y + 32, 60, 10, [60, 55, 50, 255]);
  fillRect(x + 150, y + 23, 8, 9, [60, 55, 50, 255]);
  // waves
  for (let i = 0; i < 5; i++) {
    drawLine(x + 10 + i * 36, y + 44, x + 26 + i * 36, y + 44, [180, 210, 230, 255]);
  }
}

function sceneGrid7(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [[0, 52, [120, 170, 90, 255]]]);
  // court
  fillRect(x + 10, y + 10, w - 20, 34, [90, 150, 70, 255]);
  strokeRect(x + 10, y + 10, w - 20, 34, WHITE, 1);
  drawLine(x + 10, y + 27, x + w - 10, y + 27, WHITE);
  // net
  fillRect(x + 8, y + 24, w - 16, 2, [40, 40, 40, 255]);
  // players
  drawCircle(x + 45, y + 16, 4, [178, 34, 24, 255]);
  fillRect(x + 41, y + 21, 8, 10, [178, 34, 24, 255]);
  drawCircle(x + w - 45, y + 36, 4, [22, 35, 63, 255]);
  fillRect(x + w - 49, y + 41, 8, 10, [22, 35, 63, 255]);
  // ball
  drawCircle(x + w / 2, y + 20, 3, [255, 220, 80, 255]);
}

function sceneGrid8(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [[0, 52, [228, 232, 220, 255]]]);
  // flag 1 (Pakistan green)
  drawLine(x + 30, y + 8, x + 30, y + 44, [60, 60, 60, 255]);
  fillRect(x + 30, y + 8, 34, 18, [20, 90, 50, 255]);
  drawCircle(x + 40, y + 17, 4, WHITE);
  // flag 2 (red/white)
  drawLine(x + 110, y + 8, x + 110, y + 44, [60, 60, 60, 255]);
  fillRect(x + 110, y + 8, 34, 9, [178, 34, 24, 255]);
  fillRect(x + 110, y + 17, 34, 9, WHITE);
  // globe
  drawCircle(x + 165, y + 28, 14, [60, 130, 180, 255]);
  drawEllipse(x + 165, y + 28, 6, 14, [40, 100, 150, 255]);
  drawLine(x + 151, y + 28, x + 179, y + 28, [40, 100, 150, 255]);
  fillRect(x, y + 46, w, 6, [200, 205, 195, 255]);
}

function sceneGrid9(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 24, [215, 225, 235, 255]],
    [24, 52, [45, 110, 150, 255]],
  ]);
  // capsized boat (hull upside down)
  fillPoly(
    [
      [x + 40, y + 26],
      [x + 140, y + 26],
      [x + 128, y + 34],
      [x + 52, y + 34],
    ],
    [120, 70, 45, 255]
  );
  fillRect(x + 85, y + 34, 10, 6, [120, 70, 45, 255]);
  // lifebuoy
  drawCircle(x + 160, y + 38, 8, [255, 120, 40, 255]);
  drawCircle(x + 160, y + 38, 4, [45, 110, 150, 255]);
  // waves
  for (let i = 0; i < 5; i++) {
    drawLine(x + 8 + i * 36, y + 44, x + 24 + i * 36, y + 44, [180, 210, 230, 255]);
  }
}

function sceneGrid10(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 26, [205, 225, 235, 255]],
    [26, 52, [70, 140, 180, 255]],
  ]);
  // river gauge post
  fillRect(x + 90, y + 8, 6, 40, [60, 50, 40, 255]);
  for (let i = 0; i < 4; i++) {
    fillRect(x + 96, y + 12 + i * 9, 12, 2, [255, 60, 40, 255]);
    fillRect(x + 96, y + 16 + i * 9, 8, 2, WHITE);
  }
  // water line
  drawLine(x, y + 30, x + w, y + 30, [220, 235, 245, 255]);
  // reeds
  for (let i = 0; i < 4; i++) {
    drawLine(x + 20 + i * 14, y + 48, x + 22 + i * 14, y + 34, [40, 110, 60, 255]);
  }
  // sun
  drawCircle(x + 165, y + 12, 8, [255, 220, 120, 255]);
}

function sceneGrid11(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [[0, 52, [230, 225, 205, 255]]]);
  // parliament building with dome
  fillRect(x + 30, y + 24, 120, 24, [150, 140, 120, 255]);
  drawEllipse(x + 90, y + 24, 28, 14, [90, 110, 140, 255]);
  fillRect(x + 88, y + 8, 4, 8, [90, 110, 140, 255]);
  for (let i = 0; i < 5; i++) fillRect(x + 38 + i * 24, y + 30, 10, 12, [255, 210, 110, 255]);
  // flag
  drawLine(x + 165, y + 10, x + 165, y + 44, [60, 60, 60, 255]);
  fillRect(x + 165, y + 10, 20, 12, [40, 90, 180, 255]);
  fillRect(x, y + 48, w, 4, [200, 190, 170, 255]);
}

function sceneGrid12(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 30, [220, 230, 235, 255]],
    [30, 52, [170, 200, 140, 255]],
  ]);
  // hills
  fillPoly([[x, y + 52], [x + 50, y + 34], [x + 100, y + 52]], [130, 170, 100, 255]);
  fillPoly([[x + 80, y + 52], [x + 140, y + 36], [x + w, y + 52]], [110, 150, 90, 255]);
  // cedar tree
  fillRect(x + 88, y + 36, 6, 12, [90, 60, 40, 255]);
  fillPoly([[x + 72, y + 38], [x + 91, y + 16], [x + 110, y + 38]], [30, 110, 60, 255]);
  fillPoly([[x + 76, y + 30], [x + 91, y + 12], [x + 106, y + 30]], [40, 130, 70, 255]);
  fillPoly([[x + 80, y + 22], [x + 91, y + 8], [x + 102, y + 22]], [50, 150, 85, 255]);
}

function sceneGrid13(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, [
    [0, 28, [225, 232, 220, 255]],
    [28, 52, [120, 170, 80, 255]],
  ]);
  // farm field rows
  for (let i = 0; i < 4; i++) {
    drawLine(x + 10, y + 32 + i * 5, x + 110, y + 32 + i * 5, [90, 140, 60, 255]);
  }
  // oil derrick
  drawLine(x + 150, y + 48, x + 150, y + 12, [50, 50, 50, 255]);
  drawLine(x + 138, y + 48, x + 150, y + 12, [50, 50, 50, 255]);
  drawLine(x + 162, y + 48, x + 150, y + 12, [50, 50, 50, 255]);
  drawLine(x + 142, y + 36, x + 158, y + 36, [50, 50, 50, 255]);
  drawLine(x + 145, y + 24, x + 155, y + 24, [50, 50, 50, 255]);
  // sun
  drawCircle(x + 30, y + 12, 8, [255, 215, 110, 255]);
}

// attach scenes
HEROES[0].scene = sceneHero1;
HEROES[1].scene = sceneHero2;
HEROES[2].scene = sceneHero3;
GRID[0].scene = sceneGrid4;
GRID[1].scene = sceneGrid5;
GRID[2].scene = sceneGrid6;
GRID[3].scene = sceneGrid7;
GRID[4].scene = sceneGrid8;
GRID[5].scene = sceneGrid9;
GRID[6].scene = sceneGrid10;
GRID[7].scene = sceneGrid11;
GRID[8].scene = sceneGrid12;
GRID[9].scene = sceneGrid13;

// ---------- world map (simplified outlines, equirectangular) ----------
// Map area: 300 wide x 150 tall. lon -180..180 -> x 0..300. lat 75..-60 -> y 0..150.
const MAP_W = 300;
const MAP_H = 144;

function mapXY(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * MAP_W;
  const y = ((75 - lat) / 135) * MAP_H;
  return [x, y];
}

const CONTINENTS: [number, number][][] = [
  // North America
  [[-168, 66], [-150, 70], [-130, 71], [-110, 72], [-90, 70], [-75, 62], [-65, 60], [-55, 52], [-60, 45], [-70, 42], [-75, 35], [-80, 31], [-84, 30], [-90, 21], [-96, 18], [-105, 20], [-114, 28], [-124, 40], [-130, 48], [-150, 60], [-165, 60]],
  // Greenland
  [[-45, 60], [-30, 68], [-20, 70], [-30, 76], [-55, 76], [-60, 70]],
  // South America
  [[-80, 10], [-75, 5], [-60, 0], [-50, -5], [-35, -8], [-40, -20], [-48, -28], [-55, -35], [-65, -40], [-70, -50], [-73, -55], [-70, -45], [-75, -30], [-80, -15]],
  // Europe
  [[-10, 36], [-5, 44], [-2, 48], [0, 51], [5, 53], [10, 57], [18, 56], [25, 60], [30, 62], [35, 60], [30, 55], [28, 45], [23, 40], [18, 40], [12, 44], [8, 44], [3, 43], [-2, 37]],
  // Africa
  [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [50, 10], [45, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -25], [12, -15], [8, 0], [0, 5], [-8, 5]],
  // Asia
  [[35, 60], [50, 70], [70, 72], [100, 75], [130, 72], [160, 70], [170, 65], [160, 60], [140, 55], [135, 45], [130, 40], [127, 38], [120, 30], [110, 20], [105, 10], [100, 5], [95, 15], [90, 22], [80, 15], [75, 8], [70, 20], [65, 25], [60, 25], [55, 28], [50, 30], [45, 30], [40, 35], [35, 40], [30, 45]],
  // Australia
  [[113, -22], [122, -15], [132, -12], [142, -11], [150, -20], [150, -28], [146, -38], [140, -38], [135, -35], [130, -32], [124, -33], [115, -35]],
];

function drawMap(x: number, y: number, pins: Story[]): void {
  fillRect(x, y, MAP_W, MAP_H, MAP_SEA);
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lon, lat]) => {
      const [px, py] = mapXY(lon, lat);
      return [x + px, y + py] as [number, number];
    });
    fillPoly(pts, MAP_LAND);
    strokePoly(pts, MAP_LINE);
  }
  for (const s of pins) {
    const [px, py] = mapXY(s.lon, s.lat);
    const cx = x + px + (s.mdx || 0);
    const cy = y + py + (s.mdy || 0);
    drawCircle(cx, cy, 7, RED);
    drawCircle(cx, cy, 5, WHITE);
    drawText("sansb|1", cx - 3, cy - 3, String(s.n), RED);
  }
}

// ---------- layout ----------
const M = 16;
const CW = W - M * 2;

function drawMasthead(y: number): void {
  fillRect(0, y, W, 24, INK);
  drawText("sansb|2", M, y + 5, "THE WORLD IN ONE DAY", WHITE);
  const right = "35 STORIES • 7 REGIONS • EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  drawText("sans|1", W - M - textWidth("sans|1", right), y + 8, right, WHITE);
}

function drawNumberStrip(y: number): void {
  const nums: [string, string][] = [
    ["186", "DRONES FIRED AT UKRAINE OVERNIGHT"],
    ["161", "DOWNED OR JAMMED BY AIR DEFENCE"],
    ["35%", "POWER FROM CLEAN SOURCES BY 2035"],
    ["$120BN", "AID GOAL DROPPED AT COP31"],
    ["98.79%", "HK TURNOUT, A RECORD"],
    ["720/9", "INDIA'S RECORD TEST TOTAL IN NZ"],
  ];
  // proportional columns: each column fits its number plus padding; leftover
  // space is spread as gaps. Equal columns would clip "$120BN" and "98.79%".
  const colWs = nums.map(([n]) => textWidth("serif|5", n) + 12);
  const totalW = colWs.reduce((a, b) => a + b, 0);
  const gap = Math.floor((CW - totalW) / (nums.length - 1));
  let cx = M;
  for (let i = 0; i < nums.length; i++) {
    drawText("serif|5", cx, y, nums[i][0], RED);
    drawTextBlock("sans|1", cx, y + 38, nums[i][1], colWs[i] - 6, GREY, 10, 2);
    cx += colWs[i] + gap;
  }
}

function drawRegionStrip(y: number): void {
  const regions: [string, string][] = [
    ["ASIA", "8"],
    ["MIDDLE EAST", "5"],
    ["EUROPE", "5"],
    ["AFRICA", "5"],
    ["AMERICAS", "5"],
    ["OCEANIA", "4"],
    ["GLOBAL", "3"],
  ];
  const widths = regions.map(([name, n]) => textWidth("sansb|1", `${name} ${n}`) + 16);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const gap = Math.floor((CW - totalW) / (regions.length - 1));
  let cx = M;
  for (let i = 0; i < regions.length; i++) {
    const [name, n] = regions[i];
    const w = widths[i];
    fillRect(cx, y, w, 15, REGION_COLOR[name]);
    drawText("sansb|1", cx + 8, y + 4, `${name} ${n}`, WHITE);
    cx += w + gap;
  }
}

function drawUtcStrip(y: number): void {
  fillRect(0, y, W, 18, INK);
  drawText("sansb|1", M, y + 5, "THE DAY IN UTC", WHITE);
  const items: [string, string][] = [
    ["02:00", "LISBON CAMP CLEARED"],
    ["03:00", "COP31 OBJECTIONS CLOSE"],
    ["06:00", "161 OF 186 DRONES DOWNED"],
    ["10:00", "HK POLLS CLOSE 98.79%"],
    ["17:00", "ALCARAZ-ZVEREV FINAL"],
  ];
  // measure total width, then distribute evenly across the space after the label
  const labelW = textWidth("sansb|1", "THE DAY IN UTC");
  const startX = M + labelW + 16;
  const availW = W - M - startX;
  const itemWs = items.map(([t, l]) => textWidth("sansb|1", t) + 4 + textWidth("sans|1", l));
  const totalW = itemWs.reduce((a, b) => a + b, 0);
  const gap = Math.max(8, Math.floor((availW - totalW) / (items.length - 1)));
  let cx = startX;
  for (let i = 0; i < items.length; i++) {
    const [t, l] = items[i];
    drawText("sansb|1", cx, y + 5, t, [255, 170, 60, 255]);
    cx += textWidth("sansb|1", t) + 4;
    drawText("sans|1", cx, y + 5, l, WHITE);
    cx += textWidth("sans|1", l) + gap;
  }
}

function drawHero(s: Story, x: number, y: number, w: number): void {
  const illH = 108;
  if (s.scene) s.scene(x, y, w, illH);
  strokeRect(x, y, w, illH, INK, 1);
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 4, y + 4, s.status);
  // kicker
  drawText("sansb|1", x, y + illH + 5, `${s.n} • ${s.place} • ${s.topic}`, RED);
  // headline (serif 3, up to 3 lines)
  const headLines = drawTextBlock("serif|3", x, y + illH + 18, s.headline, w, INK, 22, 3);
  // body (serif regular 1, up to 4 lines) starts right after the headline
  const bodyY = y + illH + 18 + headLines.length * 22 + 6;
  const bodyLines = drawTextBlock("serifr|1", x, bodyY, s.body, w, INK_SOFT, 13, 4);
  // source, right after the body
  drawText("sans|1", x, bodyY + bodyLines.length * 13 + 5, s.source, GREY);
}

function drawGridCell(s: Story, x: number, y: number, w: number): void {
  const illH = 50;
  if (s.scene) s.scene(x, y, w, illH);
  strokeRect(x, y, w, illH, INK, 1);
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 3, y + 3, s.status);
  drawText("sansb|1", x, y + illH + 4, `${s.n} • ${s.place} • ${s.topic}`, RED);
  drawTextBlock("serif|2", x, y + illH + 15, s.headline, w, INK, 18, 2);
  drawTextBlock("sans|1", x, y + illH + 51, s.body, w, INK_SOFT, 11, 2);
  drawText("sans|1", x, y + illH + 72, s.source, GREY);
}

function drawBottom(y: number, h: number): void {
  const mapW = 300;
  const listX = M + mapW + 10;
  const listW = W - M - listX;
  // map
  drawText("sansb|2", M, y, "WHERE IT HAPPENED", INK);
  const pins = [...HEROES, ...GRID];
  drawMap(M, y + 20, pins);
  strokeRect(M, y + 20, mapW, MAP_H, INK, 1);
  // one-liners
  drawText("sansb|2", listX, y, "ALSO ON SUNDAY 22 NOVEMBER", INK);
  drawText("sans|1", listX + textWidth("sansb|2", "ALSO ON SUNDAY 22 NOVEMBER") + 8, y + 4, "22 MORE STORIES", GREY);
  const colW = Math.floor((listW - 10) / 2);
  const rowH = 13;
  for (let i = 0; i < ONE_LINERS.length; i++) {
    const [n, place, text, status] = ONE_LINERS[i];
    const col = i < 11 ? 0 : 1;
    const row = i % 11;
    const lx = listX + col * (colW + 10);
    const ly = y + 20 + row * rowH;
    const num = String(n);
    drawText("sansb|1", lx, ly + 2, num, RED);
    const tx = lx + textWidth("sansb|1", num) + 5;
    const full = `${place}: ${text}`;
    drawText("sans|1", tx, ly + 2, full, INK);
    const tagW = textWidth("sansb|1", status);
    drawText("sansb|1", lx + colW - tagW, ly + 2, status, TAG_COLOR[status] || GREY);
  }
}

function drawDateCheck(y: number, h: number): void {
  strokeRect(M, y, CW, h, RED, 2);
  fillRect(M, y, 92, 14, RED);
  drawText("sansb|1", M + 6, y + 3, "DATE CHECK", WHITE);
  const intro = "EVERY STORY ON THIS PAGE HAPPENED OR WAS FIRST REPORTED ON SUNDAY 22 NOVEMBER 2026 (UTC). LEFT OUT BECAUSE THEY HAPPENED ON AN EARLIER DAY:";
  drawTextBlock("sans|1", M + 8, y + 18, intro, CW - 16, INK, 11, 1);
  drawTextBlock("sans|1", M + 8, y + 30, LEFT_OUT, CW - 16, RED_DARK, 11, 2);
}

function drawLegend(y: number): void {
  const parts: [string, number[]][] = [
    ["HOW TO READ THE TAGS - ", INK],
    ["CONFIRMED", TAG_COLOR.CONFIRMED], [" OFFICIAL / 2 OR MORE • ", INK_SOFT],
    ["CLAIM", TAG_COLOR.CLAIM], [" ONE SIDE'S CLAIM • ", INK_SOFT],
    ["REPORTED", TAG_COLOR.REPORTED], [" 1 SOURCE • ", INK_SOFT],
    ["PENDING", TAG_COLOR.PENDING], [" NOT SETTLED • ", INK_SOFT],
    ["ONGOING", TAG_COLOR.ONGOING], [" STILL DEVELOPING.", INK_SOFT],
  ];
  let cx = M;
  for (const [txt, c] of parts) {
    const bold = txt === "CONFIRMED" || txt === "CLAIM" || txt === "REPORTED" || txt === "PENDING" || txt === "ONGOING" || txt.startsWith("HOW TO");
    const font = bold ? "sansb|1" : "sans|1";
    drawText(font, cx, y, txt, c);
    cx += textWidth(font, txt);
  }
}

function drawSources(y: number): void {
  const s = "SOURCES: REUTERS, BBC, AP, AL JAZEERA, THE GUARDIAN, CARBON BRIEF, CHINA DAILY, KOREA JOONGANG DAILY, FRANCE 24, USA TODAY, ARAB NEWS, GMA, EIN. SCENES ARE DRAWN ILLUSTRATIONS OF REPORTED EVENTS, NOT PHOTOGRAPHS.";
  drawTextBlock("sans|1", M, y, s, CW, GREY, 11, 2);
}

function drawFooter(y: number): void {
  fillRect(0, y, W, H - y, INK);
  drawText("sansb|2", M, y + 12, "THE WORLD IN ONE DAY", WHITE);
  const right = "SUNDAY 22 NOVEMBER 2026 • ONE PAGE";
  drawText("sans|1", W - M - textWidth("sans|1", right), y + 15, right, WHITE);
}

// ---------- main ----------
function build(): void {
  fillRect(0, 0, W, H, PAPER);
  let y = 0;
  drawMasthead(y);
  y += 24;
  drawTextCentered("serif|5", W / 2, y + 4, "SUNDAY 22 NOVEMBER 2026", INK);
  y += 44;
  drawTextCentered("serif|2", W / 2, y + 2, "186 DRONES OVER UKRAINE • COP31 DROPS THE $120BN AID GOAL • IRAN CUTS POWER", RED);
  y += 20;
  drawNumberStrip(y);
  y += 54;
  drawRegionStrip(y);
  y += 16;
  drawUtcStrip(y);
  y += 22;
  // heroes
  const heroW = 324;
  const heroGap = 10;
  for (let i = 0; i < HEROES.length; i++) {
    drawHero(HEROES[i], M + i * (heroW + heroGap), y, heroW);
  }
  y += 244;
  // grid label
  drawText("serif|3", M, y, "THE DAY IN TEN", INK);
  const gridNote = "THE STORIES THAT MOVED THE WORLD TODAY";
  drawText("sans|1", W - M - textWidth("sans|1", gridNote), y + 8, gridNote, GREY);
  y += 24;
  // grid: 5 cols x 2 rows
  const cellW = 196;
  const cellGap = 5;
  const rowH = 132;
  for (let i = 0; i < GRID.length; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    drawGridCell(GRID[i], M + col * (cellW + cellGap), y + row * rowH, cellW);
  }
  y += rowH * 2 + 6;
  // bottom: map + one-liners
  drawBottom(y, 164);
  y += 164;
  // date check
  drawDateCheck(y, 50);
  y += 52;
  // legend
  drawLegend(y);
  y += 16;
  // sources
  drawSources(y);
  y += 26;
  // footer
  drawFooter(y);
}

function main(): void {
  loadAtlas();
  build();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    // /output may already exist; the write below is the only write that matters
  }
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
