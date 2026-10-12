/**
 * 주문일시 문자열에서 날짜(YYYY-MM-DD)만 뽑는다. 시간은 추이 집계에 쓰지 않는다.
 * 지원: 2026-10-01 09:12 / 2026.10.01 / 2026/10/1 / 20261001 / 2026년 10월 1일 /
 *       엑셀 날짜 일련번호(46296 등)
 * 읽을 수 없으면 null.
 */
export function parseDay(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const ymd =
    text.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/) ?? text.match(/^(\d{4})(\d{2})(\d{2})(?:\d{4}|\d{6})?$/);
  if (ymd) return toDay(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  // 날짜 서식이 빠진 엑셀 셀은 1900년 기준 일련번호로 나온다.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return toDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

function toDay(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 2월 30일 같은 값
  return formatDay(date);
}

export function formatDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(day: string, n: number): string {
  return formatDay(new Date(dayToDate(day).getTime() + n * 86400000));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToDate(to).getTime() - dayToDate(from).getTime()) / 86400000);
}
