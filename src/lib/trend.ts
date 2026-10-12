import type { DatedLine } from '../types';
import { addDays, dayToDate, daysBetween, formatDay } from './dates';

export type Granularity = 'day' | 'week' | 'month';

export interface TrendPoint {
  /** 구간 시작일 YYYY-MM-DD */
  start: string;
  /** 구간 마지막 날 (데이터 범위로 잘림) */
  end: string;
  label: string;
  revenue: number;
  orders: number;
  quantity: number;
}

export interface Trend {
  granularity: Granularity;
  points: TrendPoint[];
  firstDay: string;
  lastDay: string;
  /** 첫날~마지막 날 일수 (양 끝 포함) */
  spanDays: number;
}

/** 기간 길이에 맞는 기본 단위: 한 달 이내는 일별, 반년 이내는 주별, 그 이상은 월별 */
export function defaultGranularity(spanDays: number): Granularity {
  if (spanDays <= 31) return 'day';
  if (spanDays <= 182) return 'week';
  return 'month';
}

/** 주는 월요일에 시작한다. */
function bucketStart(day: string, g: Granularity): string {
  if (g === 'day') return day;
  if (g === 'month') return `${day.slice(0, 7)}-01`;
  const weekday = (dayToDate(day).getUTCDay() + 6) % 7; // 월=0 … 일=6
  return addDays(day, -weekday);
}

function nextBucket(start: string, g: Granularity): string {
  if (g === 'day') return addDays(start, 1);
  if (g === 'week') return addDays(start, 7);
  const d = dayToDate(start);
  return formatDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

function label(start: string, g: Granularity, multiYear: boolean): string {
  const [y, m, d] = start.split('-').map(Number);
  if (g === 'month') return multiYear ? `${String(y).slice(2)}년 ${m}월` : `${m}월`;
  const md = `${m}/${d}`;
  return g === 'week' ? `${md}~` : md;
}

/**
 * 날짜가 있는 줄을 구간별로 묶는다. 판매가 없는 구간도 0으로 채워
 * 막대 사이 간격이 실제 시간 간격과 같게 한다.
 */
export function buildTrend(lines: DatedLine[], granularity?: Granularity): Trend | null {
  if (lines.length === 0) return null;

  let firstDay = lines[0].day;
  let lastDay = lines[0].day;
  for (const l of lines) {
    if (l.day < firstDay) firstDay = l.day;
    if (l.day > lastDay) lastDay = l.day;
  }
  const spanDays = daysBetween(firstDay, lastDay) + 1;
  const g = granularity ?? defaultGranularity(spanDays);
  const multiYear = firstDay.slice(0, 4) !== lastDay.slice(0, 4);

  const buckets = new Map<string, { revenue: number; quantity: number; orders: Set<string> }>();
  for (let s = bucketStart(firstDay, g); s <= lastDay; s = nextBucket(s, g)) {
    buckets.set(s, { revenue: 0, quantity: 0, orders: new Set() });
  }
  for (const l of lines) {
    const b = buckets.get(bucketStart(l.day, g))!;
    b.revenue += l.revenue;
    b.quantity += l.quantity;
    b.orders.add(l.orderId);
  }

  const points = [...buckets.entries()].map(([start, b]) => {
    const rawEnd = addDays(nextBucket(start, g), -1);
    return {
      start: start < firstDay ? firstDay : start,
      end: rawEnd > lastDay ? lastDay : rawEnd,
      label: label(start, g, multiYear),
      revenue: b.revenue,
      orders: b.orders.size,
      quantity: b.quantity,
    };
  });

  return { granularity: g, points, firstDay, lastDay, spanDays };
}
