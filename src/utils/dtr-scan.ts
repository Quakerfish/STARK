import type { DtrRow } from './dtr';
import { rowMinutes } from './dtr';

// One row exactly as read from the sheet (times as handwritten, no AM/PM info).
export type ScannedRow = {
  date: string | null; // YYYY-MM-DD
  am_in: string | null;
  am_out: string | null;
  pm_in: string | null;
  pm_out: string | null;
};

type Clock = { h: number; m: number };

function parseClock(s: string | null | undefined): Clock | null {
  if (!s) return null;
  const match = /^\s*(\d{1,2})\s*[:.;]\s*(\d{2})\s*$/.exec(s);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

// Sheet times are written in 12-hour form. A.M. columns stay as written
// (12:xx is noon). P.M. columns get +12 for 1-11 (2:01 -> 14:01); 12:xx stays.
const to24 = (c: Clock, period: 'am' | 'pm'): Clock =>
  period === 'pm' && c.h < 12 ? { h: c.h + 12, m: c.m } : c;

function parseDate(s: string | null | undefined): Date | null {
  const match = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const at = (day: Date, c: Clock | null): Date | null =>
  c ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), c.h, c.m) : null;

// Turn scanned sheet rows into calculator rows.
// - AM In + PM Out only (like most days on the sheet) -> one row spanning the day.
// - Lunch break filled in (AM Out / PM In) -> one row per half-day.
// `guessedDateIds` lists rows whose date could not be read (set to today) so the
// review screen can highlight them.
export function scanToRows(scanned: ScannedRow[]): { rows: DtrRow[]; guessedDateIds: Set<string> } {
  const out: DtrRow[] = [];
  const guessedDateIds = new Set<string>();
  const stamp = Date.now();

  scanned.forEach((s, i) => {
    const parsedDay = parseDate(s.date);
    const day = parsedDay ?? new Date(); // unreadable date -> today, flagged for review
    const amIn = parseClock(s.am_in);
    const amOut = parseClock(s.am_out);
    const pmIn = parseClock(s.pm_in);
    const pmOut = parseClock(s.pm_out);
    if (!amIn && !amOut && !pmIn && !pmOut) return;

    const make = (j: number, tin: Clock | null, tout: Clock | null): DtrRow => {
      const id = `scan-${stamp}-${i}-${j}`;
      if (!parsedDay) guessedDateIds.add(id);
      return { id, date: day, timeIn: at(day, tin), timeOut: at(day, tout) };
    };

    if (amIn && pmOut && !amOut && !pmIn) {
      out.push(make(0, to24(amIn, 'am'), to24(pmOut, 'pm')));
      return;
    }

    if (amIn || amOut) {
      out.push(make(0, amIn && to24(amIn, 'am'), amOut && to24(amOut, 'am')));
    }
    if (pmIn || pmOut) {
      out.push(make(1, pmIn && to24(pmIn, 'pm'), pmOut && to24(pmOut, 'pm')));
    }
  });

  return { rows: out, guessedDateIds };
}

// Rows worth double-checking on the review screen: incomplete, zero length,
// or implausibly long (usually a misread digit).
export function isSuspicious(row: DtrRow): boolean {
  const min = rowMinutes(row);
  return min === null || min === 0 || min > 12 * 60;
}