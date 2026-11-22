// The World in One Day — Sunday 22 November 2026 (v7)
// A one-page newspaper front page drawn entirely in code (Node 22, stdlib only).
// 35 verified stories, 7 regions, 6-number top strip, status tag on every story,
// tag legend, UTC strip, numbered world map, DATE CHECK, LEFT OUT list.
// v7: colored header strip on every grid story, descriptive label bar on each
// hero, full UTC labels, hero 1 body restored to four lines, richer grid scenes.
// Output: exactly 1024x1024 PNG, deterministic, to MAKEFUN_OUTPUT_DIR/entry.png.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette (cream paper, navy ink, red accent) ----------
const PAPER: number[] = [245, 236, 215, 255];
const PAPER_DARK: number[] = [238, 226, 199, 255];
const INK: number[] = [22, 35, 63, 255];
const INK_SOFT: number[] = [48, 63, 96, 255];
const RED: number[] = [178, 34, 24, 255];
const RED_DARK: number[] = [140, 26, 18, 255];
const WHITE: number[] = [255, 255, 255, 255];
const GREY: number[] = [110, 110, 105, 255];
const BLACK: number[] = [12, 12, 12, 255];
const TEAL: number[] = [14, 120, 110, 255];
const GREEN: number[] = [34, 130, 60, 255];
const AMBER: number[] = [200, 130, 20, 255];
const ORANGE: number[] = [210, 90, 20, 255];
const BROWN: number[] = [120, 85, 50, 255];
const SKY_NIGHT: number[] = [26, 35, 64, 255];
const SKY_DUSK: number[] = [58, 58, 85, 255];

// ---------- framebuffer ----------
const fb = new Uint8Array(W * H * 4);
let clipX0 = 0;
let clipY0 = 0;
let clipX1 = W;
let clipY1 = H;

function setClip(x: number, y: number, w: number, h: number): void {
  clipX0 = Math.max(0, Math.floor(x));
  clipY0 = Math.max(0, Math.floor(y));
  clipX1 = Math.min(W, Math.ceil(x + w));
  clipY1 = Math.min(H, Math.ceil(y + h));
}
function resetClip(): void {
  clipX0 = 0;
  clipY0 = 0;
  clipX1 = W;
  clipY1 = H;
}

function blendPx(x: number, y: number, c: number[], a: number): void {
  if (x < clipX0 || x >= clipX1 || y < clipY0 || y >= clipY1) return;
  if (a <= 0) return;
  const i = (y * W + x) * 4;
  if (a >= 255) {
    fb[i] = c[0];
    fb[i + 1] = c[1];
    fb[i + 2] = c[2];
    fb[i + 3] = 255;
    return;
  }
  const inv = 255 - a;
  fb[i] = Math.round((c[0] * a + fb[i] * inv) / 255);
  fb[i + 1] = Math.round((c[1] * a + fb[i + 1] * inv) / 255);
  fb[i + 2] = Math.round((c[2] * a + fb[i + 2] * inv) / 255);
  fb[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(Math.floor(x), clipX0);
  const y0 = Math.max(Math.floor(y), clipY0);
  const x1 = Math.min(Math.ceil(x + w), clipX1);
  const y1 = Math.min(Math.ceil(y + h), clipY1);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
      fb[i + 3] = 255;
    }
  }
}

function strokeRect(x: number, y: number, w: number, h: number, c: number[], t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  const r2 = r * r;
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) blendPx(xx, yy, c, 255);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
    for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
      const dx = (xx - cx) / rx;
      const dy = (yy - cy) / ry;
      if (dx * dx + dy * dy <= 1) blendPx(xx, yy, c, 255);
    }
  }
}

// Scanline polygon fill. pts is a flat [x0,y0,x1,y1,...] list.
function fillPoly(pts: number[], c: number[]): void {
  const n = pts.length / 2;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pts[i * 2 + 1]);
    maxY = Math.max(maxY, pts[i * 2 + 1]);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[j * 2];
      const y1 = pts[j * 2 + 1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
        blendPx(x, y, c, 255);
      }
    }
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (let guard = 0; guard < 4096; guard++) {
    blendPx(x, y, c, 255);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// ---------- font atlas ----------
// Format: one JSON header line of glyph metrics, then raw grayscale bytes.
// Glyph key: "family|scale|char". Fields: o (byte offset), w, h, adv, bx, by.
// by is the offset from the top of the line box to the glyph top.
interface Glyph {
  o: number;
  w: number;
  h: number;
  adv: number;
  bx: number;
  by: number;
}
let atlasGlyphs: Record<string, Glyph> = {};
let atlasRaw: Buffer = Buffer.alloc(0);
let atlasBase = 0;
const allowedChars = new Set<string>();

function loadAtlas(): void {
  const botDir = process.env.MAKEFUN_BOT_DIR || ".";
  const file = path.join(botDir, "font-atlas.bin");
  const data = fs.readFileSync(file);
  const nl = data.indexOf(10);
  const header = JSON.parse(data.subarray(0, nl).toString("utf8"));
  atlasGlyphs = header.glyphs as Record<string, Glyph>;
  atlasBase = nl + 1;
  atlasRaw = data;
  for (const k of Object.keys(atlasGlyphs)) {
    allowedChars.add(k.split("|", 3)[2]);
  }
}

function sanitize(s: string): string {
  let out = "";
  for (const ch of s.toUpperCase()) {
    if (ch === "·") out += "•";
    else if (ch === "—" || ch === "–") out += "-";
    else if (ch === "&") out += "AND";
    else if (allowedChars.has(ch)) out += ch;
    else if (ch === " ") out += " ";
    // any other character is dropped (atlas has no glyph for it)
  }
  return out;
}

function glyphOf(font: string, ch: string): Glyph | undefined {
  return atlasGlyphs[font + "|" + ch];
}

function textWidth(font: string, s: string): number {
  const t = sanitize(s);
  let w = 0;
  for (const ch of t) {
    const g = glyphOf(font, ch);
    w += g ? g.adv : (glyphOf(font, " ")?.adv ?? 6);
  }
  return w;
}

// Draw text. y is the top of the line box.
function drawText(font: string, x: number, y: number, s: string, c: number[]): void {
  const t = sanitize(s);
  let cx = Math.round(x);
  const top = Math.round(y);
  for (const ch of t) {
    const g = glyphOf(font, ch);
    if (!g) {
      cx += glyphOf(font, " ")?.adv ?? 6;
      continue;
    }
    if (g.w > 0 && g.h > 0) {
      for (let gy = 0; gy < g.h; gy++) {
        const row = g.o + gy * g.w;
        for (let gx = 0; gx < g.w; gx++) {
          const a = atlasRaw[atlasBase + row + gx];
          if (a > 0) blendPx(cx + g.bx + gx, top + g.by + gy, c, a);
        }
      }
    }
    cx += g.adv;
  }
}

function drawTextCentered(font: string, cx: number, y: number, s: string, c: number[]): void {
  drawText(font, cx - textWidth(font, s) / 2, y, s, c);
}

// Greedy word wrap. Returns the lines.
function wrapText(font: string, s: string, maxW: number): string[] {
  const words = sanitize(s).split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(font, trial) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw a wrapped block. align: "left" or "center". Returns lines drawn.
function drawTextBlock(
  font: string,
  x: number,
  y: number,
  s: string,
  maxW: number,
  c: number[],
  lineH: number,
  maxLines: number,
  align: "left" | "center" = "left"
): number {
  const lines = wrapText(font, s, maxW).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    if (align === "center") drawTextCentered(font, x + maxW / 2, y + i * lineH, lines[i], c);
    else drawText(font, x, y + i * lineH, lines[i], c);
  }
  return lines.length;
}

// Line heights per font (line box + a little air).
const LH: Record<string, number> = {
  "serif|5": 46,
  "serif|3": 27,
  "serif|2": 17,
  "serifr|1": 14,
  "sansb|2": 18,
  "sansb|1": 10,
  "sans|2": 18,
  "sans|1": 10,
};

// ---------- PNG encoder (own implementation, stdlib only) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const rowBytes = W * 3;
  const raw = Buffer.alloc(H * (rowBytes + 1));
  for (let y = 0; y < H; y++) {
    const dst = y * (rowBytes + 1);
    raw[dst] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4;
      const di = dst + 1 + x * 3;
      raw[di] = fb[si];
      raw[di + 1] = fb[si + 1];
      raw[di + 2] = fb[si + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- data (35 verified stories, from the dissection brief) ----------
type Status = "CONFIRMED" | "CLAIM" | "REPORTED" | "PENDING" | "ONGOING";
const TAG_COLOR: Record<Status, number[]> = {
  CONFIRMED: GREEN,
  CLAIM: RED,
  REPORTED: TEAL,
  PENDING: GREY,
  ONGOING: ORANGE,
};

interface Hero {
  n: number;
  place: string;
  topic: string;
  headline: string;
  body: string;
  source: string;
  status: Status;
  label: string;
  lon: number;
  lat: number;
  mdx: number;
  mdy: number;
}

const HEROES: Hero[] = [
  {
    n: 1,
    place: "ANTALYA, TURKIYE",
    topic: "CLIMATE",
    headline: "COP31 DROPS FOSSIL FUELS",
    body: "THE TEXT NEVER MENTIONS FOSSIL FUELS AND SETS NO $120BN AID GOAL. IT KEEPS 35% POWER BY 2035. AND ADMITS 1.5C WILL BE OVERSHOT.",
    source: "CARBON BRIEF",
    status: "ONGOING",
    label: "NO ADOPTION AT PRESS TIME",
    lon: 30.7,
    lat: 36.9,
    mdx: 0,
    mdy: 0,
  },
  {
    n: 2,
    place: "KYIV, UKRAINE",
    topic: "WAR",
    headline: "RUSSIA FIRES 186 DRONES",
    body: "RUSSIA FIRED 186 DRONES, 72 JET-POWERED. AIR DEFENCE DOWNED 161, BUT 18 SITES WERE HIT AND A DYMER BLOCK FELL, 14 MISSING.",
    source: "REUTERS",
    status: "CONFIRMED",
    label: "161 DOWNED • 14 MISSING",
    lon: 30.5,
    lat: 50.4,
    mdx: 0,
    mdy: 0,
  },
  {
    n: 3,
    place: "TEHRAN, IRAN",
    topic: "ENERGY",
    headline: "IRAN BEGINS POWER CUTS",
    body: "ROLLING CUTS OF UP TO TWO HOURS A DAY BEGIN AS FUEL RUNS SHORT. STRIKES ON GAS PLANTS BITE, AND THE US BLOCKADE HITS DAY 130.",
    source: "RFE/RL • FRANCE 24",
    status: "REPORTED",
    label: "DAY 130 OF BLOCKADE",
    lon: 51.4,
    lat: 35.7,
    mdx: -4,
    mdy: -2,
  },
];

interface GridStory {
  n: number;
  place: string;
  topic: string;
  header: string;
  headerColor: number[];
  headline: string;
  body: string;
  source: string;
  status: Status;
  lon: number;
  lat: number;
  mdx: number;
  mdy: number;
}

const GRID: GridStory[] = [
  {
    n: 4, place: "HONG KONG", topic: "ELECTION",
    header: "HONG KONG VOTES", headerColor: RED,
    headline: "HK ELECTS ITS COMMITTEE",
    body: "RECORD 98.79% TURNOUT, 856 CANDIDATES FOR 723 SEATS.",
    source: "CHINA DAILY", status: "CONFIRMED",
    lon: 114.2, lat: 22.3, mdx: 0, mdy: 0,
  },
  {
    n: 5, place: "SEOUL", topic: "EDUCATION",
    header: "MINISTER QUITS", headerColor: INK,
    headline: "EDUCATION MINISTER RESIGNS",
    body: "CHOI KYO-JIN QUITS OVER AI CHEATING, ACCEPTED SAME DAY.",
    source: "KOREA JOONGANG DAILY", status: "CONFIRMED",
    lon: 127.0, lat: 37.5, mdx: 0, mdy: 0,
  },
  {
    n: 6, place: "STRAIT OF HORMUZ", topic: "SEA",
    header: "2 TANKERS HIT", headerColor: TEAL,
    headline: "TWO TANKERS HIT NEAR HORMUZ",
    body: "NO INJURIES, BOTH SHIPS SAFE.",
    source: "FRANCE 24", status: "REPORTED",
    lon: 56.5, lat: 26.5, mdx: 4, mdy: 4,
  },
  {
    n: 7, place: "TURIN", topic: "TENNIS",
    header: "ALCARAZ v ZVEREV", headerColor: GREEN,
    headline: "ALCARAZ MEETS ZVEREV IN FINAL",
    body: "SUNDAY EVENING, IN TURIN.",
    source: "USA TODAY", status: "CONFIRMED",
    lon: 7.7, lat: 45.1, mdx: 0, mdy: 0,
  },
  {
    n: 8, place: "ISLAMABAD", topic: "DIPLOMACY",
    header: "TALKS HOPE", headerColor: INK,
    headline: "PAKISTAN FM HOPES FOR TALKS",
    body: "ISLAMABAD URGES TALKS.",
    source: "ARAB NEWS", status: "REPORTED",
    lon: 73.1, lat: 33.7, mdx: 0, mdy: 0,
  },
  {
    n: 9, place: "BAYELSA, NIGERIA", topic: "DISASTER",
    header: "BOAT TOLL 24", headerColor: RED,
    headline: "NIGERIA BOAT TOLL RISES TO 24",
    body: "24 SURVIVORS, RESCUE UNDER WAY.",
    source: "REUTERS", status: "CONFIRMED",
    lon: 6.3, lat: 4.9, mdx: 0, mdy: 0,
  },
  {
    n: 10, place: "FLORIDA", topic: "WEATHER",
    header: "RIVER RECORD", headerColor: TEAL,
    headline: "ST. JOHNS RIVER BREAKS RECORD",
    body: "WATER AT ITS HIGHEST SINCE 1952.",
    source: "AP", status: "CONFIRMED",
    lon: -81.5, lat: 29.5, mdx: 0, mdy: 0,
  },
  {
    n: 11, place: "ISRAEL", topic: "POLITICS",
    header: "TALKS INVITE", headerColor: INK,
    headline: "EISENKOT INVITES LIKUD TO TALKS",
    body: "NEW ALIGNMENT SOUGHT IN ISRAEL.",
    source: "ARAB NEWS", status: "REPORTED",
    lon: 35.2, lat: 31.8, mdx: -6, mdy: 2,
  },
  {
    n: 12, place: "LEBANON", topic: "POLITICS",
    header: "ARMS ROW", headerColor: GREEN,
    headline: "AOUN: NO ARMS OUTSIDE STATE",
    body: "BEIRUT SAYS THE STATE MUST HOLD ALL ARMS.",
    source: "ARAB NEWS", status: "REPORTED",
    lon: 35.5, lat: 33.9, mdx: 6, mdy: -6,
  },
  {
    n: 13, place: "MANILA", topic: "POLITICS",
    header: "MARCOS CORRECTS TRUMP", headerColor: RED,
    headline: "MARCOS CLARIFIES TRUMP CLAIM",
    body: "THE PRESIDENT CORRECTS THE RECORD.",
    source: "GMA", status: "CLAIM",
    lon: 121.0, lat: 14.6, mdx: 0, mdy: 0,
  },
];

// [n, place, text, status]
const ONE_LINERS: [number, string, string, Status][] = [
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

const REGIONS: [string, string, number[]][] = [
  ["ASIA", "8", TEAL],
  ["MIDDLE EAST", "5", RED],
  ["EUROPE", "5", INK],
  ["AFRICA", "5", GREEN],
  ["AMERICAS", "5", ORANGE],
  ["OCEANIA", "4", BROWN],
  ["GLOBAL", "3", GREY],
];

const NUMBERS: [string, string][] = [
  ["186", "DRONES FIRED AT UKRAINE OVERNIGHT"],
  ["161", "DOWNED OR JAMMED BY AIR DEFENCE"],
  ["35%", "POWER FROM CLEAN SOURCES BY 2035"],
  ["$120BN", "AID GOAL DROPPED AT COP31"],
  ["98.79%", "HK TURNOUT, A RECORD"],
  ["720/9", "INDIA'S RECORD TEST TOTAL IN NZ"],
];

const UTC_ITEMS: [string, string][] = [
  ["02:00", "LISBON CAMP CLEARED"],
  ["03:00", "COP31 OBJECTIONS CLOSE"],
  ["06:00", "161 OF 186 DRONES DOWNED"],
  ["10:00", "HK POLLS CLOSE 98.79%"],
  ["17:00", "ALCARAZ-ZVEREV FINAL"],
];

const LEFT_OUT =
  "21 NOV: EU-INDONESIA TRADE DEAL SIGNED • EL CHAPO ISIDRO CAPTURED IN SINALOA • TRUMP BACKS 10% CREDIT CARD CAP • IRAQ HARTHA POWER STATION FIRE KILLS 4 • LA / LONG BEACH PORT STRIKE AVERTED • ALCARAZ BEATS SHELTON IN ATP SEMI-FINAL • 20 NOV: BAYER $7.25BN ROUNDUP SETTLEMENT APPROVED • FBI PROBES NCIC DATABASE HACK.";

const SOURCES =
  "SOURCES: REUTERS, BBC, AP, AL JAZEERA, THE GUARDIAN, CARBON BRIEF, CHINA DAILY, KOREA JOONGANG DAILY, FRANCE 24, USA TODAY, ARAB NEWS, GMA, EIN. SCENES ARE DRAWN ILLUSTRATIONS OF REPORTED EVENTS, NOT PHOTOGRAPHS.";

// ---------- shared bits ----------
function tagWidth(status: Status): number {
  return textWidth("sansb|1", status) + 8;
}

// Status tag pill, top-left at (x, y), height 11.
function drawTag(x: number, y: number, status: Status): void {
  const w = tagWidth(status);
  fillRect(x, y, w, 11, TAG_COLOR[status]);
  drawText("sansb|1", x + 4, y + 2, status, WHITE);
}

// ---------- hero scenes (drawn inside the illustration rect) ----------
// COP31 meeting hall at sunset, Antalya.
function sceneCop31(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [232, 165, 107, 255]); // warm sunset sky
  fillRect(x, y + Math.floor(h * 0.45), w, Math.floor(h * 0.55), [242, 193, 132, 255]);
  fillCircle(x + Math.floor(w * 0.82), y + Math.floor(h * 0.2), 12, [250, 230, 170, 255]);
  // distant mountains
  fillPoly(
    [x, y + h * 0.62, x + w * 0.18, y + h * 0.42, x + w * 0.36, y + h * 0.6, x + w * 0.55, y + h * 0.45, x + w * 0.78, y + h * 0.62, x + w, y + h * 0.5, x + w, y + h * 0.62],
    [120, 90, 80, 255]
  );
  // meeting hall: long low building with a curved roof
  fillRect(x + w * 0.06, y + h * 0.62, w * 0.88, h * 0.3, [90, 70, 60, 255]);
  fillEllipse(x + w * 0.5, y + h * 0.62, w * 0.46, h * 0.1, [70, 55, 48, 255]);
  // lit windows
  for (let i = 0; i < 9; i++) {
    fillRect(x + w * 0.1 + i * (w * 0.088), y + h * 0.7, w * 0.045, h * 0.14, [250, 210, 120, 255]);
  }
  // delegates: small seated figures at a long table
  fillRect(x + w * 0.12, y + h * 0.9, w * 0.76, h * 0.05, [60, 45, 40, 255]);
  for (let i = 0; i < 7; i++) {
    const fx = x + w * 0.16 + i * (w * 0.11);
    fillCircle(fx, y + h * 0.82, 4, [40, 30, 26, 255]);
    fillRect(fx - 4, y + h * 0.85, 8, 6, [40, 30, 26, 255]);
  }
  resetClip();
}

// Kyiv night skyline, drones, searchlight, a damaged block.
function sceneKyiv(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, SKY_NIGHT);
  fillRect(x, y + Math.floor(h * 0.5), w, Math.floor(h * 0.5), [30, 42, 74, 255]);
  // stars
  const stars: [number, number][] = [
    [0.08, 0.12], [0.2, 0.06], [0.35, 0.15], [0.5, 0.08], [0.62, 0.18], [0.75, 0.07], [0.9, 0.14], [0.45, 0.25], [0.68, 0.3], [0.15, 0.28],
  ];
  for (const [sx, sy] of stars) fillRect(x + w * sx, y + h * sy, 2, 2, WHITE);
  // searchlight beam
  fillPoly(
    [x + w * 0.72, y + h, x + w * 0.62, y + h * 0.05, x + w * 0.78, y + h * 0.05],
    [210, 205, 160, 255]
  );
  // buildings
  const blds: [number, number, number, number][] = [
    [0.02, 0.55, 0.14, 0.45], [0.18, 0.45, 0.12, 0.55], [0.32, 0.6, 0.16, 0.4], [0.5, 0.5, 0.13, 0.5], [0.65, 0.58, 0.15, 0.42], [0.82, 0.48, 0.16, 0.52],
  ];
  for (const [bx, by, bw, bh] of blds) {
    fillRect(x + w * bx, y + h * by, w * bw, h * bh, [16, 20, 38, 255]);
  }
  // lit windows
  for (let i = 0; i < 22; i++) {
    const wx = x + w * (0.04 + ((i * 37) % 90) / 100);
    const wy = y + h * (0.5 + ((i * 53) % 40) / 100);
    fillRect(wx, wy, 3, 4, [250, 200, 90, 255]);
  }
  // damaged Dymer block: tilted top
  fillPoly(
    [x + w * 0.32, y + h * 0.6, x + w * 0.36, y + h * 0.5, x + w * 0.44, y + h * 0.56, x + w * 0.48, y + h * 0.6],
    [120, 60, 50, 255]
  );
  // drones: small dark diamonds with a light dot
  const drones: [number, number][] = [
    [0.25, 0.18], [0.45, 0.12], [0.6, 0.22], [0.85, 0.1],
  ];
  for (const [dx, dy] of drones) {
    fillPoly(
      [x + w * dx - 5, y + h * dy, x + w * dx, y + h * dy - 4, x + w * dx + 5, y + h * dy, x + w * dx, y + h * dy + 4],
      [10, 12, 25, 255]
    );
    fillRect(x + w * dx - 1, y + h * dy - 1, 2, 2, [255, 120, 60, 255]);
  }
  resetClip();
}

// Tehran dusk skyline, dark windows, power pylons, moon.
function sceneTehran(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, SKY_DUSK);
  fillRect(x, y + Math.floor(h * 0.55), w, Math.floor(h * 0.45), [70, 62, 92, 255]);
  fillRect(x, y + Math.floor(h * 0.62), w, 3, [230, 140, 70, 255]); // orange horizon line
  fillCircle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.16), 10, [235, 225, 200, 255]);
  // skyline
  const blds: [number, number, number, number][] = [
    [0.02, 0.62, 0.15, 0.38], [0.19, 0.55, 0.11, 0.45], [0.32, 0.66, 0.14, 0.34], [0.48, 0.58, 0.12, 0.42], [0.62, 0.64, 0.16, 0.36], [0.8, 0.56, 0.18, 0.44],
  ];
  for (const [bx, by, bw, bh] of blds) {
    fillRect(x + w * bx, y + h * by, w * bw, h * bh, [22, 22, 40, 255]);
  }
  // a few lit windows, most dark
  for (let i = 0; i < 8; i++) {
    const wx = x + w * (0.06 + ((i * 41) % 88) / 100);
    const wy = y + h * (0.6 + ((i * 29) % 30) / 100);
    fillRect(wx, wy, 3, 4, [250, 200, 90, 255]);
  }
  // power pylons
  for (const px of [0.42, 0.88]) {
    const bx = x + w * px;
    const base = y + h;
    drawLine(bx - 8, base, bx, y + h * 0.68, [14, 14, 24, 255]);
    drawLine(bx + 8, base, bx, y + h * 0.68, [14, 14, 24, 255]);
    drawLine(bx - 12, y + h * 0.72, bx + 12, y + h * 0.72, [14, 14, 24, 255]);
    drawLine(bx - 9, y + h * 0.82, bx + 9, y + h * 0.82, [14, 14, 24, 255]);
  }
  // sagging power line
  drawLine(x + w * 0.42, y + h * 0.72, x + w * 0.65, y + h * 0.8, [14, 14, 24, 255]);
  drawLine(x + w * 0.65, y + h * 0.8, x + w * 0.88, y + h * 0.72, [14, 14, 24, 255]);
  resetClip();
}

// ---------- grid scenes (small scenic drawings) ----------
// Hong Kong: ballot box with voters.
function sceneHK(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [200, 225, 215, 255]);
  fillRect(x, y + h * 0.7, w, h * 0.3, [120, 160, 120, 255]);
  // ballot box
  fillRect(x + w * 0.38, y + h * 0.3, w * 0.3, h * 0.42, [250, 250, 250, 255]);
  strokeRect(x + w * 0.38, y + h * 0.3, w * 0.3, h * 0.42, INK, 1);
  fillRect(x + w * 0.45, y + h * 0.3, w * 0.16, 3, RED);
  fillRect(x + w * 0.42, y + h * 0.18, w * 0.08, h * 0.14, RED);
  drawLine(x + w * 0.42, y + h * 0.18, x + w * 0.5, y + h * 0.3, RED);
  // voters
  for (const [vx, vc] of [[0.16, RED], [0.78, INK]] as [number, number[]][]) {
    fillCircle(x + w * vx, y + h * 0.52, 5, vc);
    fillRect(x + w * vx - 6, y + h * 0.58, 12, h * 0.14, vc);
  }
  resetClip();
}

// Seoul: ministry building with a graduation cap and an AI chip.
function sceneSeoul(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [215, 222, 235, 255]);
  fillRect(x, y + h * 0.72, w, h * 0.28, [140, 150, 165, 255]);
  // ministry building
  fillRect(x + w * 0.08, y + h * 0.34, w * 0.5, h * 0.4, [240, 235, 220, 255]);
  strokeRect(x + w * 0.08, y + h * 0.34, w * 0.5, h * 0.4, INK, 1);
  fillPoly(
    [x + w * 0.05, y + h * 0.34, x + w * 0.33, y + h * 0.2, x + w * 0.61, y + h * 0.34],
    [180, 60, 50, 255]
  );
  for (let i = 0; i < 4; i++) {
    fillRect(x + w * 0.13 + i * (w * 0.11), y + h * 0.42, w * 0.05, h * 0.24, [90, 110, 140, 255]);
  }
  // graduation cap
  fillPoly(
    [x + w * 0.66, y + h * 0.3, x + w * 0.82, y + h * 0.2, x + w * 0.96, y + h * 0.3, x + w * 0.82, y + h * 0.4],
    [30, 30, 50, 255]
  );
  fillRect(x + w * 0.76, y + h * 0.34, w * 0.12, h * 0.12, [30, 30, 50, 255]);
  // AI chip
  fillRect(x + w * 0.66, y + h * 0.55, w * 0.24, h * 0.2, TEAL);
  fillRect(x + w * 0.72, y + h * 0.6, w * 0.12, h * 0.1, WHITE);
  resetClip();
}

// Hormuz: two tankers at sea.
function sceneHormuz(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [180, 205, 225, 255]);
  fillRect(x, y + h * 0.55, w, h * 0.45, [40, 110, 160, 255]);
  // waves
  for (let i = 0; i < 5; i++) {
    drawLine(x + w * (0.05 + i * 0.18), y + h * (0.62 + (i % 2) * 0.12), x + w * (0.15 + i * 0.18), y + h * (0.62 + (i % 2) * 0.12), WHITE);
  }
  // tanker 1
  fillRect(x + w * 0.06, y + h * 0.42, w * 0.42, h * 0.14, [40, 40, 45, 255]);
  fillRect(x + w * 0.06, y + h * 0.42, w * 0.42, 3, RED);
  fillRect(x + w * 0.12, y + h * 0.3, w * 0.1, h * 0.12, [240, 240, 240, 255]);
  drawLine(x + w * 0.17, y + h * 0.3, x + w * 0.17, y + h * 0.18, INK);
  // tanker 2
  fillRect(x + w * 0.55, y + h * 0.48, w * 0.38, h * 0.12, [55, 55, 60, 255]);
  fillRect(x + w * 0.55, y + h * 0.48, w * 0.38, 3, RED);
  fillRect(x + w * 0.62, y + h * 0.38, w * 0.09, h * 0.1, [240, 240, 240, 255]);
  // smoke
  fillCircle(x + w * 0.2, y + h * 0.14, 4, [200, 200, 200, 255]);
  fillCircle(x + w * 0.24, y + h * 0.1, 5, [210, 210, 210, 255]);
  resetClip();
}

// Turin: tennis court with players.
function sceneTurin(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [90, 160, 90, 255]);
  fillRect(x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, [140, 190, 110, 255]);
  strokeRect(x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, WHITE, 1);
  drawLine(x + w * 0.5, y + h * 0.14, x + w * 0.5, y + h * 0.86, WHITE);
  drawLine(x + w * 0.08, y + h * 0.5, x + w * 0.92, y + h * 0.5, WHITE);
  // net
  fillRect(x + w * 0.08, y + h * 0.46, w * 0.84, 3, [30, 30, 30, 255]);
  // players
  fillCircle(x + w * 0.25, y + h * 0.3, 5, RED);
  fillRect(x + w * 0.22, y + h * 0.36, 7, 10, RED);
  fillCircle(x + w * 0.74, y + h * 0.66, 5, INK);
  fillRect(x + w * 0.71, y + h * 0.72, 7, 10, INK);
  // ball
  fillCircle(x + w * 0.58, y + h * 0.34, 3, [250, 230, 60, 255]);
  resetClip();
}

// Islamabad: two flags and a globe.
function sceneIslamabad(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [210, 220, 230, 255]);
  fillRect(x, y + h * 0.72, w, h * 0.28, [150, 165, 150, 255]);
  // Pakistan flag
  fillRect(x + w * 0.08, y + h * 0.18, w * 0.3, h * 0.34, GREEN);
  fillRect(x + w * 0.08, y + h * 0.18, w * 0.07, h * 0.34, WHITE);
  fillCircle(x + w * 0.24, y + h * 0.35, 6, WHITE);
  fillCircle(x + w * 0.26, y + h * 0.35, 5, GREEN);
  // US flag
  fillRect(x + w * 0.56, y + h * 0.18, w * 0.34, h * 0.34, [200, 60, 50, 255]);
  for (let i = 0; i < 3; i++) fillRect(x + w * 0.56, y + h * (0.18 + i * 0.12), w * 0.34, h * 0.05, WHITE);
  fillRect(x + w * 0.56, y + h * 0.18, w * 0.14, h * 0.16, INK);
  // globe
  fillCircle(x + w * 0.48, y + h * 0.68, 9, [80, 140, 200, 255]);
  drawLine(x + w * 0.48, y + h * 0.59, x + w * 0.48, y + h * 0.77, WHITE);
  drawLine(x + w * 0.39, y + h * 0.68, x + w * 0.57, y + h * 0.68, WHITE);
  resetClip();
}

// Bayelsa: capsized boat, rescue ring.
function sceneBayelsa(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [190, 210, 225, 255]);
  fillRect(x, y + h * 0.5, w, h * 0.5, [50, 120, 170, 255]);
  // waves
  for (let i = 0; i < 4; i++) {
    drawLine(x + w * (0.06 + i * 0.22), y + h * (0.58 + (i % 2) * 0.14), x + w * (0.16 + i * 0.22), y + h * (0.58 + (i % 2) * 0.14), WHITE);
  }
  // capsized hull, tilted
  fillPoly(
    [x + w * 0.3, y + h * 0.52, x + w * 0.72, y + h * 0.42, x + w * 0.78, y + h * 0.52, x + w * 0.36, y + h * 0.6],
    [70, 50, 40, 255]
  );
  // figures in the water
  fillCircle(x + w * 0.2, y + h * 0.6, 4, [30, 30, 30, 255]);
  fillCircle(x + w * 0.85, y + h * 0.66, 4, [30, 30, 30, 255]);
  // rescue ring
  fillCircle(x + w * 0.58, y + h * 0.72, 8, [255, 120, 40, 255]);
  fillCircle(x + w * 0.58, y + h * 0.72, 4, [50, 120, 170, 255]);
  resetClip();
}

// Florida: river gauge, high water, small bridge.
function sceneFlorida(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [200, 225, 215, 255]);
  fillRect(x, y + h * 0.6, w, h * 0.4, [70, 140, 190, 255]);
  // river bank
  fillRect(x, y + h * 0.55, w, h * 0.08, [120, 160, 110, 255]);
  // gauge post with marks
  fillRect(x + w * 0.3, y + h * 0.2, 4, h * 0.5, INK);
  for (let i = 0; i < 5; i++) {
    fillRect(x + w * 0.3, y + h * (0.24 + i * 0.09), 10, 2, RED);
  }
  // high water line
  fillRect(x + w * 0.3, y + h * 0.24, w * 0.2, 3, RED);
  // small bridge
  fillRect(x + w * 0.55, y + h * 0.38, w * 0.38, 4, [90, 70, 55, 255]);
  drawLine(x + w * 0.55, y + h * 0.38, x + w * 0.55, y + h * 0.55, [90, 70, 55, 255]);
  drawLine(x + w * 0.93, y + h * 0.38, x + w * 0.93, y + h * 0.55, [90, 70, 55, 255]);
  // sun
  fillCircle(x + w * 0.82, y + h * 0.16, 7, [250, 210, 100, 255]);
  resetClip();
}

// Israel: skyline with a gold dome.
function sceneIsrael(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [225, 215, 190, 255]);
  fillRect(x, y + h * 0.7, w, h * 0.3, [180, 165, 140, 255]);
  // buildings
  fillRect(x + w * 0.06, y + h * 0.42, w * 0.2, h * 0.3, [240, 235, 220, 255]);
  fillRect(x + w * 0.68, y + h * 0.38, w * 0.24, h * 0.34, [240, 235, 220, 255]);
  strokeRect(x + w * 0.06, y + h * 0.42, w * 0.2, h * 0.3, INK, 1);
  strokeRect(x + w * 0.68, y + h * 0.38, w * 0.24, h * 0.34, INK, 1);
  // gold dome
  fillEllipse(x + w * 0.46, y + h * 0.44, w * 0.14, h * 0.16, [220, 170, 60, 255]);
  fillRect(x + w * 0.32, y + h * 0.44, w * 0.28, h * 0.28, [245, 240, 225, 255]);
  strokeRect(x + w * 0.32, y + h * 0.44, w * 0.28, h * 0.28, INK, 1);
  drawLine(x + w * 0.46, y + h * 0.28, x + w * 0.46, y + h * 0.2, INK);
  // windows
  for (let i = 0; i < 6; i++) {
    fillRect(x + w * (0.35 + i * 0.04), y + h * 0.52, 3, 6, [90, 110, 140, 255]);
  }
  resetClip();
}

// Lebanon: cedar tree on a hill, small building.
function sceneLebanon(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [205, 225, 205, 255]);
  fillEllipse(x + w * 0.5, y + h * 0.78, w * 0.55, h * 0.22, [130, 170, 110, 255]);
  // cedar: layered triangles
  fillPoly(
    [x + w * 0.5, y + h * 0.12, x + w * 0.36, y + h * 0.38, x + w * 0.64, y + h * 0.38],
    GREEN
  );
  fillPoly(
    [x + w * 0.5, y + h * 0.28, x + w * 0.32, y + h * 0.56, x + w * 0.68, y + h * 0.56],
    [28, 110, 50, 255]
  );
  fillPoly(
    [x + w * 0.5, y + h * 0.44, x + w * 0.3, y + h * 0.68, x + w * 0.7, y + h * 0.68],
    GREEN
  );
  fillRect(x + w * 0.48, y + h * 0.68, w * 0.04, h * 0.12, [90, 65, 40, 255]);
  // small building
  fillRect(x + w * 0.74, y + h * 0.5, w * 0.2, h * 0.22, [240, 235, 220, 255]);
  strokeRect(x + w * 0.74, y + h * 0.5, w * 0.2, h * 0.22, INK, 1);
  fillPoly(
    [x + w * 0.72, y + h * 0.5, x + w * 0.84, y + h * 0.4, x + w * 0.96, y + h * 0.5],
    RED
  );
  resetClip();
}

// Manila: palace with columns, flag, palm trees.
function sceneManila(x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  fillRect(x, y, w, h, [215, 225, 235, 255]);
  fillRect(x, y + h * 0.72, w, h * 0.28, [140, 165, 120, 255]);
  // palace
  fillRect(x + w * 0.24, y + h * 0.34, w * 0.52, h * 0.4, [245, 240, 225, 255]);
  strokeRect(x + w * 0.24, y + h * 0.34, w * 0.52, h * 0.4, INK, 1);
  fillPoly(
    [x + w * 0.2, y + h * 0.34, x + w * 0.5, y + h * 0.2, x + w * 0.8, y + h * 0.34],
    [180, 60, 50, 255]
  );
  for (let i = 0; i < 4; i++) {
    fillRect(x + w * (0.3 + i * 0.11), y + h * 0.42, w * 0.05, h * 0.26, [120, 110, 95, 255]);
  }
  // flag
  drawLine(x + w * 0.5, y + h * 0.2, x + w * 0.5, y + h * 0.06, INK);
  fillRect(x + w * 0.5, y + h * 0.06, w * 0.16, h * 0.1, RED);
  // palm trees
  for (const px of [0.1, 0.9]) {
    drawLine(x + w * px, y + h * 0.72, x + w * px, y + h * 0.45, [90, 65, 40, 255]);
    fillEllipse(x + w * px, y + h * 0.42, w * 0.09, h * 0.06, GREEN);
  }
  resetClip();
}

const GRID_SCENES: ((x: number, y: number, w: number, h: number) => void)[] = [
  sceneHK, sceneSeoul, sceneHormuz, sceneTurin, sceneIslamabad,
  sceneBayelsa, sceneFlorida, sceneIsrael, sceneLebanon, sceneManila,
];
const HERO_SCENES: ((x: number, y: number, w: number, h: number) => void)[] = [
  sceneCop31, sceneKyiv, sceneTehran,
];

// ---------- world map (simplified outlines, equirectangular) ----------
// [lon, lat] polygons, approximate.
const CONTINENTS: number[][][] = [
  // North America
  [[-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 25], [-90, 21], [-97, 16], [-105, 20], [-115, 30], [-125, 40], [-125, 49], [-140, 60], [-165, 60]],
  // Greenland
  [[-55, 60], [-45, 60], [-30, 68], [-20, 70], [-35, 76], [-55, 76], [-60, 70]],
  // South America
  [[-80, 10], [-60, 5], [-50, 0], [-35, -8], [-40, -20], [-50, -30], [-60, -40], [-70, -50], [-75, -40], [-75, -20], [-80, -5]],
  // Africa
  [[-18, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 10], [51, 12], [44, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [10, -5], [8, 4], [-8, 4], [-15, 10]],
  // Europe
  [[-10, 36], [-10, 43], [-5, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [30, 70], [25, 71], [18, 69], [12, 65], [5, 60], [5, 58], [0, 55], [-5, 50], [-10, 45]],
  // Asia
  [[30, 70], [40, 68], [60, 70], [80, 73], [100, 76], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [160, 55], [150, 60], [140, 50], [135, 43], [127, 40], [122, 32], [115, 25], [108, 18], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 15], [75, 10], [72, 20], [65, 25], [60, 25], [55, 27], [50, 30], [48, 30], [45, 32], [40, 35], [35, 36], [30, 36], [28, 38], [30, 42], [35, 45], [30, 50], [30, 55], [30, 60], [30, 65]],
  // Australia
  [[113, -22], [114, -30], [115, -35], [120, -34], [125, -32], [130, -32], [135, -35], [140, -38], [145, -38], [150, -37], [153, -32], [150, -25], [145, -20], [142, -15], [140, -12], [135, -12], [130, -13], [125, -15], [120, -18], [115, -20]],
];

function drawMap(
  x: number,
  y: number,
  w: number,
  h: number,
  pins: { n: number; lon: number; lat: number; dx: number; dy: number }[]
): void {
  // ocean
  fillRect(x, y, w, h, [205, 220, 230, 255]);
  // land: lat range -60..85, lon -180..180
  const land: number[] = [225, 210, 175, 255];
  const line: number[] = [170, 155, 120, 255];
  for (const poly of CONTINENTS) {
    const pts: number[] = [];
    for (const [lon, lat] of poly) {
      pts.push(x + ((lon + 180) / 360) * w, y + ((85 - lat) / 145) * h);
    }
    fillPoly(pts, land);
    // outline
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      drawLine(Math.round(pts[i * 2]), Math.round(pts[i * 2 + 1]), Math.round(pts[j * 2]), Math.round(pts[j * 2 + 1]), line);
    }
  }
  // pins
  for (const p of pins) {
    const px = x + ((p.lon + 180) / 360) * w + p.dx;
    const py = y + ((85 - p.lat) / 145) * h + p.dy;
    fillCircle(px, py, 8, RED);
    strokeRect(px - 8, py - 8, 16, 16, WHITE, 1);
    const num = String(p.n);
    drawText("sansb|1", px - textWidth("sansb|1", num) / 2, py - 3, num, WHITE);
  }
}

// ---------- layout ----------
const M = 12;
const CW = W - 2 * M;

function drawMasthead(y: number): void {
  fillRect(0, y, W, 24, INK);
  drawText("sansb|2", M, y + 5, "THE WORLD IN ONE DAY", WHITE);
  const right = "35 STORIES • 7 REGIONS • EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  drawText("sans|1", W - M - textWidth("sans|1", right), y + 8, right, WHITE);
}

function drawNumberStrip(y: number): void {
  // Variable-width columns sized to each number, so the wide ones fit.
  const pad = 8;
  const widths = NUMBERS.map(([num]) => textWidth("serif|5", num) + pad * 2);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = M + Math.floor((CW - total) / 2);
  for (let i = 0; i < NUMBERS.length; i++) {
    const [num, label] = NUMBERS[i];
    const colW = widths[i];
    drawTextCentered("serif|5", cx + colW / 2, y, num, RED);
    drawTextBlock("sans|1", cx, y + 40, label, colW, GREY, LH["sans|1"], 2, "center");
    cx += colW;
  }
}

function drawRegionStrip(y: number): void {
  let cx = M;
  for (const [name, count, color] of REGIONS) {
    const label = name + " " + count;
    const w = textWidth("sansb|1", label) + 12;
    fillRect(cx, y, w, 18, color);
    drawText("sansb|1", cx + 6, y + 5, label, WHITE);
    cx += w + 6;
  }
}

function drawUtcStrip(y: number): void {
  fillRect(M, y, CW, 16, INK);
  let cx = M + 6;
  drawText("sansb|1", cx, y + 4, "THE DAY IN UTC", WHITE);
  cx += textWidth("sansb|1", "THE DAY IN UTC") + 14;
  for (const [time, label] of UTC_ITEMS) {
    drawText("sansb|1", cx, y + 4, time, [242, 193, 132, 255]);
    cx += textWidth("sansb|1", time) + 4;
    drawText("sans|1", cx, y + 4, label, WHITE);
    cx += textWidth("sans|1", label) + 16;
  }
}

function drawHero(s: Hero, x: number, y: number, w: number): void {
  const illH = 95;
  // illustration
  HERO_SCENES[s.n - 1](x, y, w, illH);
  strokeRect(x, y, w, illH, INK, 1);
  // status tag, top right
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 4, y + 4, s.status);
  // descriptive label bar at the bottom edge of the illustration
  fillRect(x, y + illH - 14, w, 14, BLACK);
  drawText("sansb|1", x + 6, y + illH - 11, s.label, WHITE);
  // kicker
  drawText("sansb|1", x, y + illH + 4, s.n + " • " + s.place + " • " + s.topic, RED);
  // headline (serif 3, up to 2 lines)
  drawTextBlock("serif|3", x, y + illH + 17, s.headline, w, INK, LH["serif|3"], 2);
  // body (serif regular 1, up to 4 lines)
  drawTextBlock("serifr|1", x, y + illH + 74, s.body, w, INK_SOFT, LH["serifr|1"], 4);
  // source
  drawText("sans|1", x, y + illH + 132, s.source, GREY);
}

function drawGridCell(s: GridStory, x: number, y: number, w: number): void {
  const stripH = 14;
  const illH = 47;
  // colored header strip with the short title, centered
  fillRect(x, y, w, stripH, s.headerColor);
  drawTextCentered("sansb|1", x + w / 2, y + 3, s.header, WHITE);
  // illustration
  GRID_SCENES[s.n - 4](x, y + stripH, w, illH);
  strokeRect(x, y + stripH, w, illH, INK, 1);
  // status tag, top right of the illustration
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 3, y + stripH + 3, s.status);
  const top = y + stripH + illH;
  // kicker
  drawText("sansb|1", x, top + 3, s.n + " • " + s.place + " • " + s.topic, RED);
  // headline (serif 2, up to 2 lines)
  drawTextBlock("serif|2", x, top + 14, s.headline, w, INK, LH["serif|2"], 2);
  // body (sans 1, up to 2 lines)
  drawTextBlock("sans|1", x, top + 50, s.body, w, INK_SOFT, LH["sans|1"], 2);
  // source
  drawText("sans|1", x, top + 72, s.source, GREY);
}

function drawBottom(y: number, h: number): void {
  const mapW = 300;
  const listX = M + mapW + 10;
  const listW = W - M - listX;
  // map
  drawText("sansb|2", M, y, "WHERE IT HAPPENED", INK);
  const pins = [...HEROES, ...GRID].map((s) => ({ n: s.n, lon: s.lon, lat: s.lat, dx: s.mdx || 0, dy: s.mdy || 0 }));
  drawMap(M, y + 18, mapW, h - 18, pins);
  strokeRect(M, y + 18, mapW, h - 18, INK, 1);
  // one-liners
  drawText("sansb|2", listX, y, "ALSO ON SUNDAY 22 NOVEMBER", INK);
  drawText("sans|1", listX + textWidth("sansb|2", "ALSO ON SUNDAY 22 NOVEMBER") + 8, y + 4, "22 MORE STORIES", GREY);
  const colW = Math.floor((listW - 10) / 2);
  const rowH = 12;
  for (let i = 0; i < ONE_LINERS.length; i++) {
    const [n, place, text, status] = ONE_LINERS[i];
    const col = i < 11 ? 0 : 1;
    const row = i % 11;
    const lx = listX + col * (colW + 10);
    const ly = y + 18 + row * rowH;
    const num = String(n);
    drawText("sansb|1", lx, ly + 2, num, RED);
    const tx = lx + textWidth("sansb|1", num) + 5;
    // fit the text so it never runs into the tag
    const tagW = textWidth("sansb|1", status);
    const avail = lx + colW - tagW - 6 - tx;
    let full = place + ": " + text;
    while (textWidth("sans|1", full) > avail && full.length > 4) {
      full = full.slice(0, -1);
    }
    drawText("sans|1", tx, ly + 2, full, INK);
    drawText("sansb|1", lx + colW - tagW, ly + 2, status, TAG_COLOR[status]);
  }
}

function drawDateCheck(y: number, h: number): void {
  strokeRect(M, y, CW, h, RED, 2);
  fillRect(M, y, 92, 14, RED);
  drawText("sansb|1", M + 6, y + 3, "DATE CHECK", WHITE);
  const intro =
    "EVERY STORY ON THIS PAGE HAPPENED OR WAS FIRST REPORTED ON SUNDAY 22 NOVEMBER 2026 (UTC). LEFT OUT BECAUSE THEY HAPPENED ON AN EARLIER DAY:";
  drawTextBlock("sans|1", M + 8, y + 18, intro, CW - 16, INK, LH["sans|1"], 2);
  drawTextBlock("sans|1", M + 8, y + 30, LEFT_OUT, CW - 16, RED_DARK, LH["sans|1"], 2);
}

function drawLegend(y: number): void {
  const parts: [string, number[], string][] = [
    ["HOW TO READ THE TAGS - ", INK, "sansb|1"],
    ["CONFIRMED", GREEN, "sansb|1"],
    [" OFFICIAL / 2 OR MORE • ", INK_SOFT, "sans|1"],
    ["CLAIM", RED, "sansb|1"],
    [" ONE SIDE'S CLAIM • ", INK_SOFT, "sans|1"],
    ["REPORTED", TEAL, "sansb|1"],
    [" WITNESSES / ONE SOURCE • ", INK_SOFT, "sans|1"],
    ["PENDING", GREY, "sansb|1"],
    [" NOT SETTLED YET • ", INK_SOFT, "sans|1"],
    ["ONGOING", ORANGE, "sansb|1"],
    [" STILL DEVELOPING.", INK_SOFT, "sans|1"],
  ];
  let cx = M;
  for (const [txt, c, font] of parts) {
    drawText(font, cx, y, txt, c);
    cx += textWidth(font, txt);
  }
}

function drawSources(y: number): void {
  drawTextBlock("sans|1", M, y, SOURCES, CW, GREY, LH["sans|1"], 2);
}

function drawFooter(y: number): void {
  fillRect(0, y, W, H - y, INK);
  drawText("sansb|2", M, y + 6, "THE WORLD IN ONE DAY", WHITE);
  const right = "SUNDAY 22 NOVEMBER 2026 • ONE PAGE";
  drawText("sans|1", W - M - textWidth("sans|1", right), y + 9, right, WHITE);
}

// ---------- main ----------
function build(): void {
  fillRect(0, 0, W, H, PAPER);
  let y = 0;
  drawMasthead(y);
  y += 28;
  drawTextCentered("serif|5", W / 2, y, "SUNDAY 22 NOVEMBER 2026", INK);
  y += 48;
  drawTextCentered(
    "serif|2",
    W / 2,
    y,
    "186 DRONES OVER UKRAINE • COP31 DROPS THE $120BN AID GOAL • IRAN CUTS POWER",
    RED
  );
  y += 20;
  drawNumberStrip(y);
  y += 72;
  drawRegionStrip(y);
  y += 22;
  drawUtcStrip(y);
  y += 18;
  // heroes
  const heroW = 326;
  const heroGap = 11;
  for (let i = 0; i < HEROES.length; i++) {
    drawHero(HEROES[i], M + i * (heroW + heroGap), y, heroW);
  }
  y += 240;
  // grid label
  drawText("serif|3", M, y, "THE DAY IN TEN", INK);
  const gridNote = "THE STORIES THAT MOVED THE WORLD TODAY";
  drawText("sans|1", W - M - textWidth("sans|1", gridNote), y + 8, gridNote, GREY);
  y += 24;
  // grid: 5 cols x 2 rows
  const cellW = 196;
  const cellGap = 5;
  const rowH = 142;
  for (let i = 0; i < GRID.length; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    drawGridCell(GRID[i], M + col * (cellW + cellGap), y + row * (rowH + 4), cellW);
  }
  y += rowH * 2 + 4;
  // bottom: map + one-liners
  drawBottom(y, 152);
  y += 154;
  // DATE CHECK
  drawDateCheck(y, 52);
  y += 54;
  // legend
  drawLegend(y);
  y += 14;
  // sources
  drawSources(y);
  y += 22;
  // footer fills the rest
  drawFooter(y);
}

function main(): void {
  loadAtlas();
  build();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  const png = encodePNG();
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    // the grader provides /output already; a read-only repo is fine
  }
  try {
    fs.writeFileSync(path.join(outDir, "entry.png"), png);
  } catch (e) {
    process.stderr.write("write failed: " + String(e) + "\n");
    process.exit(1);
  }
}

main();
