export type DtrRow = {
  id: string;
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

export const formatTime = (d: Date | null) => {
  if (!d) return '--:--';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Minutes worked for one row. Handles overnight shifts (out earlier than in).
export function rowMinutes(row: DtrRow): number | null {
  if (!row.timeIn || !row.timeOut) return null;
  const a = row.timeIn.getHours() * 60 + row.timeIn.getMinutes();
  const b = row.timeOut.getHours() * 60 + row.timeOut.getMinutes();
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export const toHours = (min: number) => (min / 60).toFixed(2);
export const toDuration = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;