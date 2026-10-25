import type { ScannedRow } from './dtr-scan';

// A recognized word with its bounding box in image pixels (engine-agnostic).
export type OcrElement = { text: string; left: number; top: number; right: number; bottom: number };

type Token = OcrElement & { xc: number; yc: number; h: number };

const toToken = (e: OcrElement): Token => ({
  ...e,
  xc: (e.left + e.right) / 2,
  yc: (e.top + e.bottom) / 2,
  h: Math.max(1, e.bottom - e.top),
});

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Handwriting OCR confuses letters and digits; fix the common ones.
const fixDigits = (s: string) =>
  s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');

// "11:19", "11;19", "11.19", "1119" -> "11:19". Returns null if not a plausible clock time.
function parseTime(raw: string): string | null {
  const s = fixDigits(raw.trim().replace(/\s+/g, '').replace(/[;.,'`]/g, ':'));
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(s);
  const bare = /^(\d{3,4})$/.exec(s);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (bare) {
    h = Number(bare[1].slice(0, -2));
    m = Number(bare[1].slice(-2));
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// "3/4/26", "3|4|26", "3l4l26" -> "2026-03-04". Slashes are often misread as | or l.
function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/[Oo]/g, '0');
  const m = /^(\d{1,2})[/|\\lI\-.,](\d{1,2})[/|\\lI\-.,](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const COLS = ['am_in', 'am_out', 'pm_in', 'pm_out'] as const;

// Rebuild the DTR table from positioned words. Only the date and the four time
// columns are used; the hours column and signatures are ignored.
export function parseDtrLayout(elements: OcrElement[]): ScannedRow[] {
  const tokens = elements.filter((e) => e.text.trim().length > 0).map(toToken);

  // 1. Column centers from the printed "A.M." / "P.M." headings (each spans IN+OUT).
  const amHead = tokens.find((t) => /^a\.?m\.?$/i.test(t.text.trim()));
  const pmHead = tokens.find((t) => /^p\.?m\.?$/i.test(t.text.trim()));
  let colX: number[] | null = null;
  let timeLeft = -Infinity;
  let timeRight = Infinity;
  if (amHead && pmHead && pmHead.xc > amHead.xc) {
    const w = (pmHead.xc - amHead.xc) / 2;
    colX = [amHead.xc - w / 2, amHead.xc + w / 2, pmHead.xc - w / 2, pmHead.xc + w / 2];
    timeLeft = amHead.xc - w; // right edge of the DATE column
    timeRight = pmHead.xc + w; // right edge of P.M. OUT (hours column starts after)
  }

  // 2. Dates and time candidates.
  const dateTokens: (Token & { iso: string })[] = [];
  const timeTokens: (Token & { time: string })[] = [];
  for (const t of tokens) {
    const iso = parseDate(t.text);
    if (iso) {
      dateTokens.push({ ...t, iso });
      continue;
    }
    const time = parseTime(t.text);
    if (time && t.xc > timeLeft && t.xc < timeRight) timeTokens.push({ ...t, time });
  }
  if (!colX) {
    // No header found: keep only times to the right of the dates.
    const dateRight = dateTokens.length ? median(dateTokens.map((d) => d.right)) : -Infinity;
    for (let i = timeTokens.length - 1; i >= 0; i--) if (timeTokens[i].xc <= dateRight) timeTokens.splice(i, 1);
  }
  if (timeTokens.length === 0) return [];

  // 3. Group time tokens into rows by vertical position.
  timeTokens.sort((a, b) => a.yc - b.yc);
  const medH = median(timeTokens.map((t) => t.h));
  const diffs = timeTokens.slice(1).map((t, i) => t.yc - timeTokens[i].yc);
  const rowGaps = diffs.filter((d) => d > medH * 0.5);
  const pitch = rowGaps.length ? median(rowGaps) : medH * 1.5;
  const groups: (typeof timeTokens)[] = [];
  timeTokens.forEach((t, i) => {
    if (i === 0 || t.yc - timeTokens[i - 1].yc > pitch * 0.5) groups.push([t]);
    else groups[groups.length - 1].push(t);
  });

  // 4. Build each row: assign times to columns, attach the nearest date on the left.
  const usedDates = new Set<number>();
  const rows: ScannedRow[] = [];
  for (const g of groups) {
    const ry = g.reduce((s, t) => s + t.yc, 0) / g.length;
    const row: ScannedRow = { date: null, am_in: null, am_out: null, pm_in: null, pm_out: null };
    const sorted = [...g].sort((a, b) => a.xc - b.xc);

    if (colX) {
      for (const t of sorted) {
        let best = 0;
        colX.forEach((cx, i) => {
          if (Math.abs(t.xc - cx) < Math.abs(t.xc - colX![best])) best = i;
        });
        if (!row[COLS[best]]) row[COLS[best]] = t.time;
      }
    } else {
      // Fallback by order: first = AM IN, last = PM OUT, anything between = AM OUT / PM IN.
      const times = sorted.map((t) => t.time);
      if (times.length === 1) row.am_in = times[0];
      else if (times.length === 2) [row.am_in, row.pm_out] = times;
      else if (times.length === 3) [row.am_in, row.am_out, row.pm_out] = times;
      else [row.am_in, row.am_out, row.pm_in, row.pm_out] = times;
    }

    let bestDate = -1;
    let bestDy = pitch * 0.6;
    dateTokens.forEach((d, i) => {
      const dy = Math.abs(d.yc - ry);
      if (!usedDates.has(i) && dy < bestDy) {
        bestDy = dy;
        bestDate = i;
      }
    });
    let isExample = false;
    if (bestDate >= 0) {
      usedDates.add(bestDate);
      row.date = dateTokens[bestDate].iso;
      if (Number(row.date.slice(0, 4)) < 2015) isExample = true; // the printed "Ex. 01/01/2001" row
    }
    if (tokens.some((t) => /^ex\.?$/i.test(t.text.trim()) && Math.abs(t.yc - ry) < pitch * 0.6)) isExample = true;

    if (!isExample) rows.push(row);
  }
  return rows;
}