// Launch Radar v6 - "The World in One Day: Sunday 22 November 2026"
// A one-page newspaper front page drawn entirely in code (Node 22, stdlib only).
// 35 verified stories, 7 regions, 6-number top strip, status tag on every story,
// tag legend, UTC strip, numbered world map, DATE CHECK, LEFT OUT list.
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
const RED_DARK = [146, 26, 18, 255];
const TEAL = [15, 118, 110, 255];
const GREEN = [21, 128, 61, 255];
const AMBER = [180, 83, 9, 255];
const ORANGE = [194, 65, 12, 255];
const GREY = [107, 114, 128, 255];
const WHITE = [255, 255, 255, 255];
const BLACK = [20, 20, 20, 255];
const SKY_NIGHT = [16, 28, 58, 255];
const SKY_DUSK = [42, 58, 96, 255];
const GOLD = [217, 158, 43, 255];
const SEA = [38, 96, 140, 255];
const SEA_LIGHT = [120, 170, 205, 255];
const LAND = [214, 196, 160, 255];
const GRASS = [74, 140, 74, 255];
const CLAY = [196, 120, 72, 255];

// status tag colours (no violet, each tag has its own colour)
const TAG_COLOR: Record<string, number[]> = {
  CONFIRMED: GREEN,
  CLAIM: RED,
  REPORTED: TEAL,
  PENDING: GREY,
  ONGOING: ORANGE,
};

// ---------- framebuffer ----------
const fb = new Uint8Array(W * H * 4);
function px(x: number, y: number): number {
  return (y * W + x) * 4;
}
function setPixel(x: number, y: number, c: number[]): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = px(x, y);
  fb[i] = c[0]; fb[i + 1] = c[1]; fb[i + 2] = c[2]; fb[i + 3] = 255;
}
function blendPixel(x: number, y: number, c: number[], a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  if (a >= 255) { setPixel(x, y, c); return; }
  const i = px(x, y);
  const inv = 255 - a;
  fb[i] = Math.round((c[0] * a + fb[i] * inv) / 255);
  fb[i + 1] = Math.round((c[1] * a + fb[i + 1] * inv) / 255);
  fb[i + 2] = Math.round((c[2] * a + fb[i + 2] * inv) / 255);
  fb[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}
function strokeRect(x: number, y: number, w: number, h: number, c: number[], t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
function hline(x0: number, x1: number, y: number, c: number[], t = 1): void {
  for (let yy = 0; yy < t; yy++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setPixel(x, y + yy, c);
}
function vline(x: number, y0: number, y1: number, c: number[], t = 1): void {
  for (let xx = 0; xx < t; xx++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) setPixel(x + xx, y, c);
}
// Bresenham line
function line(x0: number, y0: number, x1: number, y1: number, c: number[], t = 1): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    if (t <= 1) setPixel(x, y, c);
    else fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  const rr = Math.round(r);
  for (let dy = -rr; dy <= rr; dy++) {
    const dx = Math.floor(Math.sqrt(rr * rr - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, cy + dy, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(t));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, cy + dy, c);
  }
}
function fillPoly(points: [number, number][], c: number[]): void {
  // scanline fill for a simple polygon
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPixel(x, y, c);
    }
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  fillPoly([[x0, y0], [x1, y1], [x2, y2]], c);
}

// ---------- PNG encoder (deterministic: fixed compression level, no metadata) ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
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
function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(fb.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const comp = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", comp),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- font atlas ----------
// font-atlas.bin: one JSON header line (glyph metrics), then raw grayscale bytes.
// Glyph key: "family|scale|char". Metrics: o = byte offset into the raw data,
// w/h = bitmap size, adv = advance, bx/by = offset from pen / line top.
// by is the offset from the top of the line box to the glyph top.
interface Glyph { o: number; w: number; h: number; adv: number; bx: number; by: number; }
let atlasGlyphs: Record<string, Glyph> = {};
let atlasData: Buffer = Buffer.alloc(0);
const FONT_LINE: Record<string, number> = {};

function loadAtlas(): void {
  const base = process.env.MAKEFUN_BOT_DIR || process.cwd();
  const buf = fs.readFileSync(path.join(base, "font-atlas.bin"));
  const nl = buf.indexOf(10);
  const header = JSON.parse(buf.subarray(0, nl).toString("utf8"));
  atlasGlyphs = header.glyphs;
  atlasData = buf.subarray(nl + 1);
  // line height per font = max (by + h) over its glyphs
  const fams = new Set<string>();
  for (const k of Object.keys(atlasGlyphs)) fams.add(k.split("|").slice(0, 2).join("|"));
  for (const fam of fams) {
    let m = 0;
    for (const k of Object.keys(atlasGlyphs)) {
      if (k.startsWith(fam + "|")) {
        const g = atlasGlyphs[k];
        if (g.by + g.h > m) m = g.by + g.h;
      }
    }
    FONT_LINE[fam] = m;
  }
}
function glyphFor(font: string, ch: string): Glyph | null {
  const g = atlasGlyphs[font + "|" + ch];
  if (g) return g;
  return null;
}
function textWidth(font: string, text: string): number {
  let w = 0;
  for (const ch of text) {
    const g = glyphFor(font, ch);
    if (g) w += g.adv;
    else if (ch === " ") w += 6;
  }
  return w;
}
function drawText(font: string, x: number, top: number, text: string, color: number[]): number {
  let cx = x;
  for (const ch of text) {
    if (ch === " ") {
      const g = glyphFor(font, " ");
      cx += g ? g.adv : 6;
      continue;
    }
    const g = glyphFor(font, ch);
    if (!g) { cx += 6; continue; }
    const gx = cx + g.bx;
    const gy = top + g.by;
    for (let row = 0; row < g.h; row++) {
      for (let col = 0; col < g.w; col++) {
        const a = atlasData[g.o + row * g.w + col];
        if (a > 0) blendPixel(gx + col, gy + row, color, a);
      }
    }
    cx += g.adv;
  }
  return cx;
}
// word-wrap a string to fit maxWidth; returns lines (uppercase already)
function wrapText(font: string, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(font, trial) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      // a single word wider than the box: split it by characters
      if (textWidth(font, word) > maxWidth) {
        let part = "";
        for (const ch of word) {
          if (textWidth(font, part + ch) > maxWidth) { lines.push(part); part = ch; }
          else part += ch;
        }
        cur = part;
      } else {
        cur = word;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawTextBlock(font: string, x: number, top: number, text: string, maxWidth: number, color: number[], lineGap = 2, maxLines = 99): number {
  const lines = wrapText(font, text, maxWidth).slice(0, maxLines);
  const lh = FONT_LINE[font] + lineGap;
  let y = top;
  for (const ln of lines) {
    drawText(font, x, y, ln, color);
    y += lh;
  }
  return y;
}
function drawTextCentered(font: string, cx: number, top: number, text: string, color: number[]): void {
  const w = textWidth(font, text);
  drawText(font, Math.round(cx - w / 2), top, text, color);
}
// status tag chip: coloured rounded block with white bold text
function drawTag(x: number, y: number, tag: string, font = "sansb|1"): number {
  const c = TAG_COLOR[tag] || GREY;
  const tw = textWidth(font, tag);
  const pad = 4;
  const w = tw + pad * 2;
  const h = 11;
  fillRect(x, y, w, h, c);
  drawText(font, x + pad, y + 2, tag, WHITE);
  return w;
}
function tagWidth(tag: string, font = "sansb|1"): number {
  return textWidth(font, tag) + 8;
}

// ---------- scenes (original, code-drawn illustrations) ----------
function skyBands(x: number, y: number, w: number, h: number, top: number[], bot: number[]): void {
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
      255,
    ];
    fillRect(x, y + Math.floor((h * i) / steps), w, Math.ceil(h / steps) + 1, c);
  }
}
function windows(x: number, y: number, w: number, h: number, cols: number, rows: number, lit: number[], dark: number[], litFrac: number, seed: number): void {
  // deterministic pseudo-random lit windows from a seed
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = Math.round(x + c * cw + cw * 0.25);
      const wy = Math.round(y + r * ch + ch * 0.25);
      const ww = Math.max(2, Math.floor(cw * 0.5));
      const hh = Math.max(2, Math.floor(ch * 0.5));
      fillRect(wx, wy, ww, hh, rnd() < litFrac ? lit : dark);
    }
  }
}
function drone(x: number, y: number, s: number, c: number[]): void {
  // small quad-rotor drone: body + 4 arms + lights
  fillRect(x - s, y - 1, s * 2 + 1, 3, c);
  fillRect(x - 1, y - s, 3, s * 2 + 1, c);
  fillCircle(x - s, y - s, 2, GOLD);
  fillCircle(x + s, y - s, 2, GOLD);
  fillCircle(x - s, y + s, 2, RED);
  fillCircle(x + s, y + s, 2, RED);
  fillCircle(x, y, 3, c);
}
function star(x: number, y: number, r: number): void {
  fillCircle(x, y, r, WHITE);
  if (r >= 2) { setPixel(x - r - 1, y, WHITE); setPixel(x + r + 1, y, WHITE); setPixel(x, y - r - 1, WHITE); setPixel(x, y + r + 1, WHITE); }
}

// HERO 1 - COP31, Antalya: sunset over the meeting hall, delegates at a long table
function sceneCop31(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [214, 138, 62], [245, 214, 150]);
  fillCircle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.26), 13, [255, 214, 120, 255]);
  // mountains
  fillPoly([[x, y + h * 0.62], [x + w * 0.18, y + h * 0.34], [x + w * 0.36, y + h * 0.62]], [122, 96, 74, 255]);
  fillPoly([[x + w * 0.55, y + h * 0.62], [x + w * 0.74, y + h * 0.3], [x + w, y + h * 0.62]], [104, 82, 62, 255]);
  // hall block
  fillRect(x + Math.floor(w * 0.06), y + Math.floor(h * 0.6), Math.floor(w * 0.88), Math.floor(h * 0.4), [52, 66, 92, 255]);
  windows(x + Math.floor(w * 0.08), y + Math.floor(h * 0.63), Math.floor(w * 0.84), Math.floor(h * 0.16), 10, 1, GOLD, [30, 40, 60, 255], 0.7, 7);
  // long table + delegates
  const ty = y + Math.floor(h * 0.82);
  fillRect(x + Math.floor(w * 0.1), ty, Math.floor(w * 0.8), Math.floor(h * 0.07), [120, 84, 52, 255]);
  for (let i = 0; i < 6; i++) {
    const dx = x + Math.floor(w * (0.16 + i * 0.135));
    fillCircle(dx, ty - 7, 5, [30, 32, 40, 255]);
    fillRect(dx - 7, ty - 2, 14, 6, [30, 32, 40, 255]);
  }
  // globe on the table
  fillCircle(x + Math.floor(w * 0.5), ty - 4, 7, SEA);
  fillCircle(x + Math.floor(w * 0.5) - 2, ty - 6, 3, GRASS);
  // paper document
  fillRect(x + Math.floor(w * 0.82), ty - 6, 12, 9, WHITE);
  line(x + Math.floor(w * 0.82) + 2, ty - 4, x + Math.floor(w * 0.82) + 10, ty - 4, INK, 1);
  line(x + Math.floor(w * 0.82) + 2, ty - 1, x + Math.floor(w * 0.82) + 10, ty - 1, INK, 1);
}
// HERO 2 - Kyiv night: skyline, drones, searchlight, a fallen block
function sceneKyiv(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [10, 18, 38], [30, 48, 82]);
  star(x + Math.floor(w * 0.12), y + 12, 2);
  star(x + Math.floor(w * 0.3), y + 8, 1);
  star(x + Math.floor(w * 0.55), y + 14, 2);
  star(x + Math.floor(w * 0.85), y + 9, 1);
  star(x + Math.floor(w * 0.68), y + 22, 1);
  // searchlight beam from the right
  fillPoly([[x + w - 8, y + h], [x + Math.floor(w * 0.62), y + 6], [x + Math.floor(w * 0.7), y + 6], [x + w - 2, y + h]], [255, 240, 180, 40]);
  // skyline
  const base = y + h;
  fillRect(x + Math.floor(w * 0.02), base - 52, 34, 52, [16, 24, 44, 255]);
  fillRect(x + Math.floor(w * 0.16), base - 74, 40, 74, [20, 30, 52, 255]);
  fillRect(x + Math.floor(w * 0.32), base - 44, 30, 44, [16, 24, 44, 255]);
  fillRect(x + Math.floor(w * 0.48), base - 64, 36, 64, [20, 30, 52, 255]);
  fillRect(x + Math.floor(w * 0.64), base - 40, 30, 40, [16, 24, 44, 255]);
  fillRect(x + Math.floor(w * 0.78), base - 58, 38, 58, [20, 30, 52, 255]);
  windows(x + Math.floor(w * 0.02), base - 52, 34, 52, 3, 5, GOLD, [24, 34, 58, 255], 0.55, 11);
  windows(x + Math.floor(w * 0.16), base - 74, 40, 74, 3, 7, GOLD, [24, 34, 58, 255], 0.5, 23);
  windows(x + Math.floor(w * 0.48), base - 64, 36, 64, 3, 6, GOLD, [24, 34, 58, 255], 0.45, 31);
  windows(x + Math.floor(w * 0.78), base - 58, 38, 58, 3, 5, GOLD, [24, 34, 58, 255], 0.5, 47);
  // fallen block (tilted slab, left foreground)
  fillPoly([[x + 6, base - 6], [x + 52, base - 18], [x + 58, base - 2], [x + 10, base]], [120, 116, 110, 255]);
  fillPoly([[x + 6, base - 6], [x + 52, base - 18], [x + 50, base - 24], [x + 4, base - 12]], [90, 86, 80, 255]);
  // drones overhead
  drone(x + Math.floor(w * 0.3), y + 26, 6, [220, 220, 220, 255]);
  drone(x + Math.floor(w * 0.55), y + 16, 5, [220, 220, 220, 255]);
  drone(x + Math.floor(w * 0.82), y + 30, 6, [220, 220, 220, 255]);
}
// HERO 3 - Tehran power cuts: dusk skyline, dark windows, pylons, crescent moon
function sceneTehran(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [36, 52, 92], [214, 150, 92]);
  // crescent moon
  fillCircle(x + Math.floor(w * 0.84), y + 16, 11, [245, 232, 190, 255]);
  fillCircle(x + Math.floor(w * 0.84) + 5, y + 13, 10, [36, 52, 92, 255]);
  // skyline, mostly dark windows
  const base = y + h;
  fillRect(x + Math.floor(w * 0.03), base - 46, 30, 46, [28, 32, 52, 255]);
  fillRect(x + Math.floor(w * 0.15), base - 66, 34, 66, [32, 36, 58, 255]);
  fillRect(x + Math.floor(w * 0.3), base - 40, 28, 40, [28, 32, 52, 255]);
  fillRect(x + Math.floor(w * 0.44), base - 58, 34, 58, [32, 36, 58, 255]);
  fillRect(x + Math.floor(w * 0.58), base - 36, 26, 36, [28, 32, 52, 255]);
  fillRect(x + Math.floor(w * 0.7), base - 50, 32, 50, [32, 36, 58, 255]);
  fillRect(x + Math.floor(w * 0.84), base - 42, 28, 42, [28, 32, 52, 255]);
  windows(x + Math.floor(w * 0.03), base - 46, 30, 46, 3, 4, GOLD, [20, 22, 38, 255], 0.18, 5);
  windows(x + Math.floor(w * 0.15), base - 66, 34, 66, 3, 6, GOLD, [20, 22, 38, 255], 0.15, 13);
  windows(x + Math.floor(w * 0.44), base - 58, 34, 58, 3, 5, GOLD, [20, 22, 38, 255], 0.2, 29);
  windows(x + Math.floor(w * 0.7), base - 50, 32, 50, 3, 4, GOLD, [20, 22, 38, 255], 0.15, 41);
  // power pylons + sagging lines
  for (const px0 of [0.22, 0.52, 0.82]) {
    const pxp = x + Math.floor(w * px0);
    line(pxp - 8, base - 78, pxp, base - 96, INK, 2);
    line(pxp + 8, base - 78, pxp, base - 96, INK, 2);
    line(pxp, base - 96, pxp, base - 70, INK, 2);
    line(pxp - 10, base - 88, pxp + 10, base - 88, INK, 2);
  }
  line(x + Math.floor(w * 0.22), base - 90, x + Math.floor(w * 0.52), base - 84, INK, 1);
  line(x + Math.floor(w * 0.52), base - 90, x + Math.floor(w * 0.82), base - 84, INK, 1);
}

// GRID scenes (small, ~196x52). Each is a simple original vignette.
function gridHongKong(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [242, 228, 205, 255]);
  // ballot box
  fillRect(x + Math.floor(w * 0.08), y + Math.floor(h * 0.34), Math.floor(w * 0.3), Math.floor(h * 0.52), RED);
  fillRect(x + Math.floor(w * 0.05), y + Math.floor(h * 0.26), Math.floor(w * 0.36), Math.floor(h * 0.1), RED_DARK);
  fillRect(x + Math.floor(w * 0.17), y + Math.floor(h * 0.26), 4, Math.floor(h * 0.1), PAPER);
  // ballot paper going in, with a check
  fillRect(x + Math.floor(w * 0.2), y + Math.floor(h * 0.08), Math.floor(w * 0.12), Math.floor(h * 0.2), WHITE);
  line(x + Math.floor(w * 0.22), y + Math.floor(h * 0.16), x + Math.floor(w * 0.25), y + Math.floor(h * 0.22), GREEN, 2);
  line(x + Math.floor(w * 0.25), y + Math.floor(h * 0.22), x + Math.floor(w * 0.3), y + Math.floor(h * 0.1), GREEN, 2);
  // crowd dots
  for (let i = 0; i < 5; i++) {
    fillCircle(x + Math.floor(w * (0.52 + i * 0.09)), y + Math.floor(h * 0.62), 4, INK);
    fillRect(x + Math.floor(w * (0.52 + i * 0.09)) - 5, y + Math.floor(h * 0.68), 10, 8, INK);
  }
  fillRect(x, y + h - 3, w, 3, RED);
}
function gridKorea(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [224, 232, 226, 255]);
  // school building
  fillRect(x + Math.floor(w * 0.06), y + Math.floor(h * 0.3), Math.floor(w * 0.42), Math.floor(h * 0.6), [120, 128, 140, 255]);
  fillTriangle(x + Math.floor(w * 0.04), y + Math.floor(h * 0.32), x + Math.floor(w * 0.27), y + Math.floor(h * 0.12), x + Math.floor(w * 0.5), y + Math.floor(h * 0.32), RED_DARK);
  windows(x + Math.floor(w * 0.08), y + Math.floor(h * 0.4), Math.floor(w * 0.38), Math.floor(h * 0.42), 3, 2, GOLD, [70, 78, 90, 255], 0.6, 3);
  // graduation cap
  fillPoly([[x + Math.floor(w * 0.62), y + Math.floor(h * 0.3)], [x + Math.floor(w * 0.82), y + Math.floor(h * 0.2)], [x + Math.floor(w * 0.94), y + Math.floor(h * 0.34)], [x + Math.floor(w * 0.76), y + Math.floor(h * 0.44)]], INK);
  fillRect(x + Math.floor(w * 0.72), y + Math.floor(h * 0.42), Math.floor(w * 0.08), Math.floor(h * 0.16), INK);
  // AI chip
  fillRect(x + Math.floor(w * 0.58), y + Math.floor(h * 0.62), Math.floor(w * 0.2), Math.floor(h * 0.26), TEAL);
  fillRect(x + Math.floor(w * 0.63), y + Math.floor(h * 0.68), Math.floor(w * 0.1), Math.floor(h * 0.14), WHITE);
}
function gridTankers(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [214, 226, 232], [244, 232, 200]);
  fillCircle(x + Math.floor(w * 0.85), y + 10, 7, GOLD);
  // sea
  fillRect(x, y + Math.floor(h * 0.58), w, Math.floor(h * 0.42), SEA);
  // tanker 1
  fillRect(x + Math.floor(w * 0.06), y + Math.floor(h * 0.44), Math.floor(w * 0.34), Math.floor(h * 0.18), [120, 40, 34, 255]);
  fillRect(x + Math.floor(w * 0.12), y + Math.floor(h * 0.3), Math.floor(w * 0.1), Math.floor(h * 0.16), WHITE);
  // tanker 2
  fillRect(x + Math.floor(w * 0.56), y + Math.floor(h * 0.48), Math.floor(w * 0.34), Math.floor(h * 0.16), [40, 60, 90, 255]);
  fillRect(x + Math.floor(w * 0.66), y + Math.floor(h * 0.36), Math.floor(w * 0.08), Math.floor(h * 0.14), WHITE);
  // waves
  for (let i = 0; i < 4; i++) {
    line(x + 4 + i * 44, y + Math.floor(h * 0.78), x + 24 + i * 44, y + Math.floor(h * 0.78), WHITE, 2);
    line(x + 14 + i * 44, y + Math.floor(h * 0.9), x + 34 + i * 44, y + Math.floor(h * 0.9), WHITE, 2);
  }
}
function gridTennis(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [58, 128, 70, 255]);
  // court lines
  strokeRect(x + Math.floor(w * 0.08), y + Math.floor(h * 0.14), Math.floor(w * 0.84), Math.floor(h * 0.72), WHITE, 2);
  line(x + Math.floor(w * 0.5), y + Math.floor(h * 0.14), x + Math.floor(w * 0.5), y + Math.floor(h * 0.86), WHITE, 2);
  // net
  fillRect(x + Math.floor(w * 0.08), y + Math.floor(h * 0.48), Math.floor(w * 0.84), 3, [30, 30, 30, 255]);
  // ball
  fillCircle(x + Math.floor(w * 0.72), y + Math.floor(h * 0.3), 6, [220, 240, 60, 255]);
  // racket
  fillEllipse(x + Math.floor(w * 0.24), y + Math.floor(h * 0.62), 10, 12, [200, 200, 200, 255]);
  fillEllipse(x + Math.floor(w * 0.24), y + Math.floor(h * 0.62), 7, 9, [58, 128, 70, 255]);
  line(x + Math.floor(w * 0.24), y + Math.floor(h * 0.72), x + Math.floor(w * 0.24), y + Math.floor(h * 0.9), [160, 120, 70, 255], 3);
}
function gridPakistan(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 226, 200, 255]);
  // two flag poles
  line(x + Math.floor(w * 0.2), y + 6, x + Math.floor(w * 0.2), y + h - 8, INK, 2);
  line(x + Math.floor(w * 0.42), y + 6, x + Math.floor(w * 0.42), y + h - 8, INK, 2);
  // flag 1 (green with white stripe)
  fillRect(x + Math.floor(w * 0.22), y + 6, Math.floor(w * 0.2), 12, GREEN);
  fillRect(x + Math.floor(w * 0.22), y + 6, 4, 12, WHITE);
  // flag 2 (red/white stripes)
  fillRect(x + Math.floor(w * 0.44), y + 6, Math.floor(w * 0.2), 12, RED);
  fillRect(x + Math.floor(w * 0.44), y + 12, Math.floor(w * 0.2), 3, WHITE);
  // globe between
  fillCircle(x + Math.floor(w * 0.74), y + Math.floor(h * 0.55), 13, SEA);
  fillCircle(x + Math.floor(w * 0.71), y + Math.floor(h * 0.5), 5, GRASS);
  fillCircle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.62), 4, GRASS);
  // handshake suggestion: two hands
  fillRect(x + Math.floor(w * 0.56), y + Math.floor(h * 0.78), Math.floor(w * 0.3), 4, [200, 160, 120, 255]);
}
function gridBoat(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [200, 214, 226], [240, 228, 200]);
  fillRect(x, y + Math.floor(h * 0.5), w, Math.floor(h * 0.5), SEA);
  // capsized hull (tilted)
  fillPoly([[x + Math.floor(w * 0.14), y + Math.floor(h * 0.52)], [x + Math.floor(w * 0.62), y + Math.floor(h * 0.34)], [x + Math.floor(w * 0.66), y + Math.floor(h * 0.44)], [x + Math.floor(w * 0.18), y + Math.floor(h * 0.62)]], [120, 70, 40, 255]);
  // people in water
  fillCircle(x + Math.floor(w * 0.72), y + Math.floor(h * 0.58), 4, [30, 30, 30, 255]);
  fillCircle(x + Math.floor(w * 0.8), y + Math.floor(h * 0.66), 4, [30, 30, 30, 255]);
  // waves
  for (let i = 0; i < 4; i++) {
    line(x + 4 + i * 44, y + Math.floor(h * 0.72), x + 24 + i * 44, y + Math.floor(h * 0.72), WHITE, 2);
    line(x + 14 + i * 44, y + Math.floor(h * 0.88), x + 34 + i * 44, y + Math.floor(h * 0.88), WHITE, 2);
  }
}
function gridRiver(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 228, 214, 255]);
  // trees
  fillTriangle(x + Math.floor(w * 0.1), y + Math.floor(h * 0.2), x + Math.floor(w * 0.16), y + Math.floor(h * 0.05), x + Math.floor(w * 0.22), y + Math.floor(h * 0.2), GRASS);
  fillTriangle(x + Math.floor(w * 0.78), y + Math.floor(h * 0.24), x + Math.floor(w * 0.84), y + Math.floor(h * 0.08), x + Math.floor(w * 0.9), y + Math.floor(h * 0.24), GRASS);
  // river (high water)
  fillRect(x, y + Math.floor(h * 0.42), w, Math.floor(h * 0.58), SEA);
  // gauge post with record mark
  fillRect(x + Math.floor(w * 0.46), y + Math.floor(h * 0.18), 4, Math.floor(h * 0.7), WHITE);
  for (let i = 0; i < 5; i++) line(x + Math.floor(w * 0.46), y + Math.floor(h * (0.24 + i * 0.12)), x + Math.floor(w * 0.46) + 8, y + Math.floor(h * (0.24 + i * 0.12)), WHITE, 2);
  fillRect(x + Math.floor(w * 0.46) - 2, y + Math.floor(h * 0.2), 14, 3, RED);
  // ripple lines
  line(x + 8, y + Math.floor(h * 0.6), x + 40, y + Math.floor(h * 0.6), WHITE, 2);
  line(x + Math.floor(w * 0.6), y + Math.floor(h * 0.72), x + Math.floor(w * 0.6) + 34, y + Math.floor(h * 0.72), WHITE, 2);
  line(x + 20, y + Math.floor(h * 0.84), x + 52, y + Math.floor(h * 0.84), WHITE, 2);
}
function gridParliament(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 222, 200, 255]);
  // parliament block with dome
  fillRect(x + Math.floor(w * 0.14), y + Math.floor(h * 0.4), Math.floor(w * 0.72), Math.floor(h * 0.5), [150, 140, 120, 255]);
  fillEllipse(x + Math.floor(w * 0.5), y + Math.floor(h * 0.38), Math.floor(w * 0.2), Math.floor(h * 0.14), [90, 100, 120, 255]);
  // columns
  for (let i = 0; i < 5; i++) fillRect(x + Math.floor(w * (0.2 + i * 0.13)), y + Math.floor(h * 0.48), 5, Math.floor(h * 0.38), WHITE);
  // podium + speaker
  fillRect(x + Math.floor(w * 0.44), y + Math.floor(h * 0.72), Math.floor(w * 0.12), Math.floor(h * 0.18), INK);
  fillCircle(x + Math.floor(w * 0.5), y + Math.floor(h * 0.68), 4, INK);
  // flags
  line(x + Math.floor(w * 0.06), y + 4, x + Math.floor(w * 0.06), y + Math.floor(h * 0.4), INK, 2);
  fillRect(x + Math.floor(w * 0.08), y + 4, 12, 8, [40, 90, 180, 255]);
}
function gridCedar(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [226, 232, 214, 255]);
  // cedar tree (layered triangles)
  fillTriangle(x + Math.floor(w * 0.3), y + Math.floor(h * 0.3), x + Math.floor(w * 0.5), y + Math.floor(h * 0.08), x + Math.floor(w * 0.7), y + Math.floor(h * 0.3), [30, 110, 60, 255]);
  fillTriangle(x + Math.floor(w * 0.24), y + Math.floor(h * 0.46), x + Math.floor(w * 0.5), y + Math.floor(h * 0.2), x + Math.floor(w * 0.76), y + Math.floor(h * 0.46), [40, 130, 70, 255]);
  fillTriangle(x + Math.floor(w * 0.18), y + Math.floor(h * 0.62), x + Math.floor(w * 0.5), y + Math.floor(h * 0.34), x + Math.floor(w * 0.82), y + Math.floor(h * 0.62), [30, 110, 60, 255]);
  fillRect(x + Math.floor(w * 0.47), y + Math.floor(h * 0.62), Math.floor(w * 0.06), Math.floor(h * 0.24), [120, 84, 52, 255]);
  // small flag stripes
  fillRect(x + Math.floor(w * 0.06), y + 6, 14, 4, RED);
  fillRect(x + Math.floor(w * 0.06), y + 12, 14, 4, WHITE);
  fillRect(x + Math.floor(w * 0.06), y + 18, 14, 4, RED);
}
function gridFarm(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [200, 220, 235], [245, 230, 190]);
  fillCircle(x + Math.floor(w * 0.82), y + 9, 7, GOLD);
  // field rows
  fillRect(x, y + Math.floor(h * 0.5), w, Math.floor(h * 0.5), [110, 150, 80, 255]);
  for (let i = 0; i < 4; i++) {
    line(x, y + Math.floor(h * (0.58 + i * 0.1)), x + w, y + Math.floor(h * (0.52 + i * 0.1)), [80, 120, 55, 255], 2);
  }
  // oil derrick
  const dx = x + Math.floor(w * 0.16);
  line(dx, y + Math.floor(h * 0.5), dx + 10, y + Math.floor(h * 0.12), INK, 3);
  line(dx + 22, y + Math.floor(h * 0.5), dx + 12, y + Math.floor(h * 0.12), INK, 3);
  line(dx, y + Math.floor(h * 0.34), dx + 22, y + Math.floor(h * 0.34), INK, 2);
  line(dx + 4, y + Math.floor(h * 0.42), dx + 18, y + Math.floor(h * 0.42), INK, 2);
  fillRect(dx + 6, y + Math.floor(h * 0.06), 12, 6, INK);
  // wheat stalk
  line(x + Math.floor(w * 0.62), y + Math.floor(h * 0.9), x + Math.floor(w * 0.62), y + Math.floor(h * 0.55), GOLD, 2);
  fillEllipse(x + Math.floor(w * 0.62), y + Math.floor(h * 0.5), 5, 9, GOLD);
}

// ---------- world map (simplified continents + numbered pins) ----------
// Rough continent shapes in 0..100 map coords (x = east, y = north-up inverted).
const CONTINENTS: [number, number][][] = [
  // North America
  [[6, 16], [16, 10], [28, 12], [30, 20], [24, 26], [26, 34], [18, 40], [10, 38], [6, 28]],
  // South America
  [[28, 52], [36, 48], [38, 58], [34, 74], [28, 70], [26, 58]],
  // Europe
  [[47, 14], [56, 10], [60, 18], [58, 26], [50, 28], [46, 20]],
  // Africa
  [[47, 36], [58, 32], [62, 44], [60, 60], [52, 62], [46, 48]],
  // Asia
  [[60, 10], [78, 8], [95, 12], [96, 28], [88, 40], [76, 34], [68, 42], [60, 30]],
  // Australia
  [[82, 66], [94, 64], [96, 74], [88, 80], [82, 74]],
];
function drawMap(x: number, y: number, w: number, h: number, pins: { n: number; lon: number; lat: number; dx?: number; dy?: number }[]): void {
  fillRect(x, y, w, h, [196, 214, 228, 255]);
  // continents
  for (const poly of CONTINENTS) {
    const pts = poly.map(([px, py]): [number, number] => [x + (px / 100) * w, y + (py / 100) * h]);
    fillPoly(pts, LAND);
  }
  // graticule
  for (let i = 1; i < 4; i++) vline(x + Math.floor((w * i) / 4), y, y + h, [255, 255, 255, 90], 1);
  for (let i = 1; i < 3; i++) hline(x, x + w, y + Math.floor((h * i) / 3), [255, 255, 255, 90], 1);
  // pins
  for (const p of pins) {
    const px = x + ((p.lon + 180) / 360) * w + (p.dx || 0);
    const py = y + ((90 - p.lat) / 180) * h + (p.dy || 0);
    fillCircle(Math.round(px), Math.round(py), 7, RED);
    strokeRect(Math.round(px) - 7, Math.round(py) - 7, 14, 14, WHITE, 1);
    const label = String(p.n);
    const tw = textWidth("sansb|1", label);
    drawText("sansb|1", Math.round(px - tw / 2), Math.round(py) - 3, label, WHITE);
  }
}

// ---------- story data (all facts from the brief; no invention) ----------
interface Story {
  n: number; place: string; topic: string; headline: string; body: string;
  source: string; status: string; scene?: (x: number, y: number, w: number, h: number) => void;
  lon: number; lat: number; mdx?: number; mdy?: number;
}
const HEROES: Story[] = [
  {
    n: 1, place: "ANTALYA, TURKIYE", topic: "CLIMATE",
    headline: "COP31 TEXT DROPS FOSSIL FUELS, NO AID GOAL",
    body: "THE TEXT NEVER MENTIONS FOSSIL FUELS AND SETS NO $120BN AID GOAL. IT KEEPS 35% POWER BY 2035.",
    source: "CARBON BRIEF", status: "ONGOING", scene: sceneCop31, lon: 30.7, lat: 36.9, mdx: -8, mdy: -6,
  },
  {
    n: 2, place: "KYIV, UKRAINE", topic: "WAR",
    headline: "RUSSIA FIRES 186 DRONES, 161 DOWNED",
    body: "RUSSIA FIRED 186 DRONES, 72 JET-POWERED. AIR DEFENCE DOWNED 161, BUT A DYMER BLOCK FELL, 14 MISSING.",
    source: "REUTERS", status: "CONFIRMED", scene: sceneKyiv, lon: 30.5, lat: 50.5, mdx: -6, mdy: 6,
  },
  {
    n: 3, place: "TEHRAN, IRAN", topic: "ENERGY",
    headline: "IRAN BEGINS ROLLING POWER CUTS",
    body: "ROLLING CUTS OF UP TO TWO HOURS A DAY BEGIN AS FUEL RUNS SHORT. THE US BLOCKADE HITS DAY 130.",
    source: "RFE/RL • FRANCE 24", status: "REPORTED", scene: sceneTehran, lon: 51.4, lat: 35.7, mdx: 8, mdy: 4,
  },
];
const GRID: Story[] = [
  { n: 4, place: "HONG KONG", topic: "ELECTION", headline: "HONG KONG ELECTS ITS COMMITTEE", body: "RECORD 98.79% TURNOUT, 856 CANDIDATES FOR 723 SEATS.", source: "CHINA DAILY", status: "CONFIRMED", scene: gridHongKong, lon: 114.2, lat: 22.3 },
  { n: 5, place: "SEOUL", topic: "EDUCATION", headline: "EDUCATION MINISTER RESIGNS", body: "CHOI KYO-JIN QUITS OVER AI CHEATING, ACCEPTED SAME DAY.", source: "KOREA JOONGANG DAILY", status: "CONFIRMED", scene: gridKorea, lon: 127, lat: 37.5 },
  { n: 6, place: "STRAIT OF HORMUZ", topic: "SEA", headline: "TWO TANKERS HIT NEAR HORMUZ", body: "NO INJURIES, BOTH SHIPS SAFE.", source: "FRANCE 24", status: "REPORTED", scene: gridTankers, lon: 56.5, lat: 26.5, mdx: 4, mdy: 6 },
  { n: 7, place: "TURIN", topic: "TENNIS", headline: "ALCARAZ MEETS ZVEREV IN FINAL", body: "SUNDAY EVENING, IN TURIN.", source: "USA TODAY", status: "CONFIRMED", scene: gridTennis, lon: 7.7, lat: 45.1, mdx: -4, mdy: -6 },
  { n: 8, place: "ISLAMABAD", topic: "DIPLOMACY", headline: "PAKISTAN FM HOPES FOR US-IRAN DEAL", body: "ISLAMABAD URGES TALKS.", source: "ARAB NEWS", status: "REPORTED", scene: gridPakistan, lon: 73, lat: 33.7, mdx: 6, mdy: -4 },
  { n: 9, place: "BAYELSA, NIGERIA", topic: "DISASTER", headline: "NIGERIA BOAT TOLL RISES TO 24", body: "24 SURVIVORS, RESCUE UNDER WAY.", source: "REUTERS", status: "CONFIRMED", scene: gridBoat, lon: 6.3, lat: 4.9, mdx: -6, mdy: 4 },
  { n: 10, place: "FLORIDA", topic: "WEATHER", headline: "ST. JOHNS RIVER BREAKS RECORD", body: "WATER AT ITS HIGHEST SINCE 1952.", source: "AP", status: "CONFIRMED", scene: gridRiver, lon: -81.7, lat: 28.5, mdx: 6, mdy: -4 },
  { n: 11, place: "ISRAEL", topic: "POLITICS", headline: "EISENKOT INVITES LIKUD TO TALKS", body: "NEW ALIGNMENT SOUGHT IN ISRAEL.", source: "ARAB NEWS", status: "REPORTED", scene: gridParliament, lon: 35.2, lat: 31.8, mdx: -10, mdy: 8 },
  { n: 12, place: "LEBANON", topic: "POLITICS", headline: "AOUN: NO ARMS OUTSIDE STATE", body: "BEIRUT SAYS THE STATE MUST HOLD ALL ARMS.", source: "ARAB NEWS", status: "REPORTED", scene: gridCedar, lon: 35.5, lat: 33.9, mdx: 10, mdy: -8 },
  { n: 13, place: "MANILA", topic: "POLITICS", headline: "MARCOS CLARIFIES TRUMP CLAIM", body: "THE PRESIDENT CORRECTS THE RECORD.", source: "GMA", status: "CLAIM", scene: gridFarm, lon: 121, lat: 14.6, mdx: 4, mdy: 4 },
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
const NUMBERS: [string, string][] = [
  ["186", "DRONES FIRED AT UKRAINE OVERNIGHT"],
  ["161", "DOWNED OR JAMMED BY AIR DEFENCE"],
  ["35%", "POWER FROM CLEAN SOURCES BY 2035"],
  ["$120BN", "AID GOAL DROPPED AT COP31"],
  ["98.79%", "HK TURNOUT, A RECORD"],
  ["720/9", "INDIA'S RECORD TEST TOTAL IN NZ"],
];
const REGIONS: [string, number[]][] = [
  ["ASIA 8", TEAL], ["MIDDLE EAST 5", RED], ["EUROPE 5", INK],
  ["AFRICA 5", GREEN], ["AMERICAS 5", ORANGE], ["OCEANIA 4", [139, 92, 46, 255]],
  ["GLOBAL 3", GREY],
];
const UTC_ITEMS: [string, string][] = [
  ["02:00", "LISBON CAMP CLEAR"],
  ["03:00", "COP31 OBJECTIONS"],
  ["06:00", "161 OF 186 DRONES DOWNED"],
  ["10:00", "HK POLLS CLOSE 98.79%"],
  ["17:00", "ALCARAZ-ZVEREV FINAL"],
];
const LEFT_OUT = "21 NOV: EU-INDONESIA TRADE DEAL SIGNED • 'EL CHAPO ISIDRO' CAPTURED IN SINALOA • TRUMP BACKS 10% CREDIT CARD CAP • IRAQ HARTHA POWER STATION FIRE KILLS 4 • LA / LONG BEACH PORT STRIKE AVERTED • ALCARAZ BEATS SHELTON IN ATP SEMI-FINAL. 20 NOV: BAYER $7.25BN ROUNDUP SETTLEMENT APPROVED • FBI PROBES NCIC DATABASE HACK.";

// ---------- layout ----------
const M = 12; // margin
const CW = W - M * 2; // 1000 content width

function drawMasthead(y: number): void {
  fillRect(0, y, W, 20, INK);
  drawText("sansb|2", M, y + 3, "THE WORLD IN ONE DAY", WHITE);
  const right = "35 STORIES • 7 REGIONS • EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  drawText("sans|1", W - M - textWidth("sans|1", right), y + 7, right, WHITE);
}
function drawNumberStrip(y: number): void {
  // six big red numbers, variable spacing so the wide ones never collide
  const widths = NUMBERS.map(([num]) => textWidth("serif|5", num));
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = (CW - total) / (NUMBERS.length - 1);
  let cx = M;
  const centers: number[] = [];
  for (let i = 0; i < NUMBERS.length; i++) {
    const w = widths[i];
    centers.push(cx + w / 2);
    drawText("serif|5", Math.round(cx), y, NUMBERS[i][0], RED);
    cx += w + gap;
  }
  // captions, centred under each number, wrapped to two lines
  for (let i = 0; i < NUMBERS.length; i++) {
    const lines = wrapText("sans|1", NUMBERS[i][1], 128).slice(0, 2);
    let ly = y + 40;
    for (const ln of lines) {
      const lw = textWidth("sans|1", ln);
      drawText("sans|1", Math.round(centers[i] - lw / 2), ly, ln, INK_SOFT);
      ly += 9;
    }
  }
  // thin rule under the strip
  hline(M, W - M, y + 56, INK, 1);
}
function drawRegionStrip(y: number): void {
  const widths = REGIONS.map(([label]) => textWidth("sansb|1", label) + 16);
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = (CW - total) / (REGIONS.length - 1);
  let cx = M;
  for (let i = 0; i < REGIONS.length; i++) {
    fillRect(Math.round(cx), y, widths[i], 18, REGIONS[i][1]);
    drawText("sansb|1", Math.round(cx) + 8, y + 6, REGIONS[i][0], WHITE);
    cx += widths[i] + gap;
  }
}
function drawUtcStrip(y: number): void {
  fillRect(M, y, CW, 18, INK);
  drawText("sansb|1", M + 8, y + 6, "THE DAY IN UTC", GOLD);
  // five items spread across the bar; measure each with its real fonts
  const itemW = UTC_ITEMS.map(([t, label]) => textWidth("sansb|1", t) + 4 + textWidth("sans|1", label));
  const totalW = itemW.reduce((a, b) => a + b, 0);
  const startX = M + 118;
  const avail = W - M - startX;
  const gap = Math.max(6, (avail - totalW) / (UTC_ITEMS.length - 1));
  let cx = startX;
  for (let i = 0; i < UTC_ITEMS.length; i++) {
    const [t, label] = UTC_ITEMS[i];
    drawText("sansb|1", Math.round(cx), y + 6, t, GOLD);
    const tw = textWidth("sansb|1", t);
    drawText("sans|1", Math.round(cx) + tw + 4, y + 6, label, WHITE);
    cx += itemW[i] + gap;
  }
}
function heroHeight(s: Story, w: number): number {
  const illH = 88;
  const hl = wrapText("serif|3", s.headline, w).slice(0, 3).length;
  const bl = wrapText("serifr|1", s.body, w).slice(0, 3).length;
  return illH + 4 + 10 + 2 + hl * (FONT_LINE["serif|3"] + 1) + 2 + bl * (FONT_LINE["serifr|1"] + 1) + 4 + 10;
}
function drawHero(s: Story, x: number, y: number, w: number): void {
  const illH = 88;
  if (s.scene) s.scene(x, y, w, illH);
  strokeRect(x, y, w, illH, INK, 1);
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 4, y + 4, s.status);
  let cy = y + illH + 4;
  drawText("sansb|1", x, cy, s.n + " • " + s.place + " • " + s.topic, RED);
  cy += 12;
  cy = drawTextBlock("serif|3", x, cy, s.headline, w, INK, 1, 3);
  cy += 2;
  cy = drawTextBlock("serifr|1", x, cy, s.body, w, INK_SOFT, 1, 3);
  cy += 4;
  drawText("sans|1", x, cy, s.source, GREY);
}
function gridCellHeight(s: Story, w: number): number {
  const illH = 44;
  const hl = wrapText("serif|2", s.headline, w).slice(0, 2).length;
  const bl = wrapText("sans|1", s.body, w).slice(0, 2).length;
  return illH + 3 + 10 + 2 + hl * (FONT_LINE["serif|2"] + 1) + 2 + bl * (FONT_LINE["sans|1"] + 1) + 2 + 9;
}
function drawGridCell(s: Story, x: number, y: number, w: number): void {
  const illH = 44;
  if (s.scene) s.scene(x, y, w, illH);
  strokeRect(x, y, w, illH, INK, 1);
  const tw = tagWidth(s.status);
  drawTag(x + w - tw - 3, y + 3, s.status);
  let cy = y + illH + 3;
  drawText("sansb|1", x, cy, s.n + " • " + s.place + " • " + s.topic, RED);
  cy += 12;
  cy = drawTextBlock("serif|2", x, cy, s.headline, w, INK, 1, 2);
  cy += 2;
  cy = drawTextBlock("sans|1", x, cy, s.body, w, INK_SOFT, 1, 2);
  cy += 2;
  drawText("sans|1", x, cy, s.source, GREY);
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
    const full = place + ": " + text;
    drawText("sans|1", tx, ly + 2, full, INK);
    // tag word at the right edge, coloured
    const tagW = textWidth("sansb|1", status);
    drawText("sansb|1", lx + colW - tagW, ly + 2, status, TAG_COLOR[status] || GREY);
  }
}
function drawDateCheck(y: number, h: number): void {
  strokeRect(M, y, CW, h, RED, 2);
  fillRect(M, y, 92, 16, RED);
  drawText("sansb|1", M + 6, y + 5, "DATE CHECK", WHITE);
  const intro = "EVERY STORY HERE HAPPENED OR WAS FIRST REPORTED ON SUNDAY 22 NOVEMBER 2026 (UTC). LEFT OUT BECAUSE THEY HAPPENED EARLIER:";
  drawTextBlock("sans|1", M + 8, y + 20, intro, CW - 16, INK, 1, 2);
  drawTextBlock("sans|1", M + 8, y + 38, LEFT_OUT, CW - 16, RED_DARK, 1, 3);
}
function drawLegend(y: number): void {
  const parts: [string, number[]][] = [
    ["HOW TO READ THE TAGS - ", INK],
    ["CONFIRMED", GREEN], [" OFFICIAL / 2 OR MORE • ", INK_SOFT],
    ["CLAIM", RED], [" ONE SIDE'S CLAIM • ", INK_SOFT],
    ["REPORTED", TEAL], [" 1 SOURCE • ", INK_SOFT],
    ["PENDING", GREY], [" NOT SETTLED • ", INK_SOFT],
    ["ONGOING", ORANGE], [" STILL DEVELOPING", INK_SOFT],
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
  drawTextBlock("sans|1", M, y, s, CW, GREY, 1, 2);
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
  drawMasthead(y); y += 24;
  drawTextCentered("serif|5", W / 2, y, "SUNDAY 22 NOVEMBER 2026", INK);
  y += 42;
  drawTextCentered("serif|2", W / 2, y, "186 DRONES OVER UKRAINE • COP31 DROPS THE $120BN AID GOAL • IRAN CUTS POWER", RED);
  y += 18;
  drawNumberStrip(y); y += 60;
  drawRegionStrip(y); y += 22;
  drawUtcStrip(y); y += 22;
  // heroes (height from the tallest hero, so the three align)
  const heroW = 326;
  const heroGap = 11;
  const heroH = Math.max(...HEROES.map((s) => heroHeight(s, heroW)));
  for (let i = 0; i < HEROES.length; i++) {
    drawHero(HEROES[i], M + i * (heroW + heroGap), y, heroW);
  }
  y += heroH + 4;
  // grid label
  drawText("serif|3", M, y, "THE DAY IN TEN", INK);
  const gridNote = "THE STORIES THAT MOVED THE WORLD TODAY";
  drawText("sans|1", W - M - textWidth("sans|1", gridNote), y + 8, gridNote, GREY);
  y += 24;
  // grid: 5 cols x 2 rows (row height from the tallest cell in the row)
  const cellW = 196;
  const cellGap = 5;
  for (let row = 0; row < 2; row++) {
    const rowCells = GRID.slice(row * 5, row * 5 + 5);
    const rowH = Math.max(...rowCells.map((s) => gridCellHeight(s, cellW)));
    for (let col = 0; col < 5; col++) {
      drawGridCell(rowCells[col], M + col * (cellW + cellGap), y, cellW);
    }
    y += rowH + 4;
  }
  // bottom: map + one-liners
  drawBottom(y, 170);
  y += 176;
  // date check
  drawDateCheck(y, 56);
  y += 62;
  // legend
  drawLegend(y);
  y += 16;
  // sources
  drawSources(y);
  y += 24;
  // footer
  drawFooter(y);
}

function main(): void {
  loadAtlas();
  build();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "entry.png"), png);
  } catch (e) {
    // the sandbox only allows /output; if that fails, there is nothing else to do
    throw e;
  }
  // local copy for viewing (never in the sandbox: /bot is read-only, so this is skipped there)
  try {
    const local = path.join(process.env.MAKEFUN_BOT_DIR || process.cwd(), "out");
    fs.mkdirSync(local, { recursive: true });
    fs.writeFileSync(path.join(local, "entry.png"), png);
  } catch {
    // ignore: outside /output writes are not allowed in the grader
  }
}

main();
