import type {
  InventoryBase,
  InventoryBuildResult,
  InventoryCriteria,
  InventoryDiagnosis,
  InventoryItem,
  InventoryMapping,
  ParsedSheet,
  Verdict,
} from '../types';
import { formatCount, toNumber } from './normalize';

export const DEFAULT_CRITERIA: InventoryCriteria = { shortWeeks: 1, soonWeeks: 2, topPercent: 20 };

export const INVENTORY_REQUIRED = ['productName', 'sales', 'stock', 'weeklySales'] as const;

export const VERDICT_ORDER: Verdict[] = ['reorder', 'short', 'soon', 'check', 'ok'];

export const VERDICT_LABEL: Record<Verdict, string> = {
  reorder: '리오더 우선',
  short: '부족',
  soon: '소진임박',
  check: '데이터 확인 필요',
  ok: '정상',
};

export function missingInventoryRequired(mapping: InventoryMapping): string[] {
  return INVENTORY_REQUIRED.filter((f) => mapping[f] === null);
}

/**
 * 원본 줄을 옵션(상품명+옵션) 단위로 합친다.
 * 같은 옵션이 로케이션별로 여러 줄이면 판매량·재고·주간 판매량을 더하고 로케이션을 모은다.
 */
export function buildInventory(sheet: ParsedSheet, mapping: InventoryMapping): InventoryBuildResult {
  const missing = missingInventoryRequired(mapping);
  if (missing.length > 0) throw new Error(`필수 항목이 매칭되지 않았습니다: ${missing.join(', ')}`);
  const col = mapping as InventoryMapping & Record<(typeof INVENTORY_REQUIRED)[number], number>;

  const byKey = new Map<string, InventoryBase>();
  let usedRows = 0;
  let skippedInvalid = 0;

  for (const row of sheet.rows) {
    const productName = row[col.productName]?.trim() ?? '';
    const option = mapping.option !== null ? row[mapping.option]?.trim() ?? '' : '';
    const sales = toNumber(row[col.sales] ?? '');
    const stock = toNumber(row[col.stock] ?? '');
    const weeklySales = toNumber(row[col.weeklySales] ?? '');

    if (!productName || [sales, stock, weeklySales].some(Number.isNaN)) {
      skippedInvalid++;
      continue;
    }
    usedRows++;

    const key = `${productName}\u0000${option}`;
    const item = byKey.get(key) ?? {
      key,
      productName,
      option,
      locations: [],
      sales: 0,
      stock: 0,
      weeklySales: 0,
      sourceRows: 0,
    };
    item.sales += sales;
    item.stock += stock;
    item.weeklySales += weeklySales;
    item.sourceRows++;
    const location = mapping.location !== null ? row[mapping.location]?.trim() ?? '' : '';
    if (location && !item.locations.includes(location)) item.locations.push(location);
    byKey.set(key, item);
  }

  return { items: [...byKey.values()], usedRows, skippedInvalid };
}

/** 예상 소진일 = 재고 ÷ 주간 판매량 × 7 */
export function daysLeft(stock: number, weeklySales: number): number | null {
  if (stock < 0 || weeklySales <= 0) return null;
  return (stock / weeklySales) * 7;
}

/** 기준 숫자를 판정에 쓸 수 있는 범위로 맞춘다. 소진임박 기준은 부족 기준보다 커야 한다. */
export function normalizeCriteria(c: InventoryCriteria): InventoryCriteria {
  const shortWeeks = Number.isFinite(c.shortWeeks) && c.shortWeeks > 0 ? c.shortWeeks : DEFAULT_CRITERIA.shortWeeks;
  const soonWeeks = Number.isFinite(c.soonWeeks) && c.soonWeeks > shortWeeks ? c.soonWeeks : shortWeeks * 2;
  const topPercent = Number.isFinite(c.topPercent)
    ? Math.min(Math.max(c.topPercent, 0), 100)
    : DEFAULT_CRITERIA.topPercent;
  return { shortWeeks, soonWeeks, topPercent };
}

const weeks = (n: number) => `${formatCount(n)}주치`;

/**
 * 옵션별 판정.
 * 1) 재고·판매량이 음수 → 데이터 확인 필요
 * 2) 재고 < 주간 판매 × 부족 기준 → 부족 (판매량 상위 N% 안이면 리오더 우선)
 * 3) 재고 < 주간 판매 × 소진임박 기준 → 소진임박
 * 4) 그 외 → 정상
 */
export function judgeInventory(base: InventoryBase[], criteria: InventoryCriteria): InventoryDiagnosis {
  const { shortWeeks, soonWeeks, topPercent } = normalizeCriteria(criteria);

  // 상위 N%: 판매량 내림차순으로 ceil(n × N%)번째 상품의 판매량 이상이면 상위로 본다 (동점 포함).
  const salesDesc = base.map((b) => b.sales).sort((a, b) => b - a);
  const topCount = Math.ceil((base.length * topPercent) / 100);
  const cut = topCount > 0 ? salesDesc[topCount - 1] : undefined;
  const topThreshold = cut !== undefined && cut > 0 ? cut : null;

  const counts: Record<Verdict, number> = { reorder: 0, short: 0, soon: 0, check: 0, ok: 0 };

  const items: InventoryItem[] = base.map((b) => {
    const isTopSeller = topThreshold !== null && b.sales >= topThreshold;
    const salesRank = salesDesc.findIndex((s) => s === b.sales) + 1;
    const stockText = formatCount(b.stock);
    const weeklyText = formatCount(b.weeklySales);

    let verdict: Verdict;
    let reason: string;
    if (b.stock < 0) {
      verdict = 'check';
      reason = `현재 재고가 음수(${stockText})입니다. 입출고 누락이나 재고 실사를 확인하세요.`;
    } else if (b.weeklySales < 0 || b.sales < 0) {
      verdict = 'check';
      reason = '판매량이 음수입니다. 반품 처리 방식이나 원본 데이터를 확인하세요.';
    } else if (b.stock < b.weeklySales * shortWeeks) {
      verdict = isTopSeller ? 'reorder' : 'short';
      reason = `재고 ${stockText}개가 주간 판매 ${weeklyText}개의 ${weeks(shortWeeks)}보다 적습니다.`;
      if (isTopSeller) reason = `판매량 상위 ${formatCount(topPercent)}% 상품인데 ${reason}`;
    } else if (b.stock < b.weeklySales * soonWeeks) {
      verdict = 'soon';
      reason = `재고 ${stockText}개가 주간 판매 ${weeklyText}개의 ${weeks(soonWeeks)}보다 적습니다.`;
    } else {
      verdict = 'ok';
      reason = b.weeklySales === 0 ? '최근 주간 판매가 없습니다.' : `재고가 주간 판매의 ${weeks(soonWeeks)} 이상입니다.`;
    }

    counts[verdict]++;
    return { ...b, verdict, reason, daysLeft: daysLeft(b.stock, b.weeklySales), salesRank, isTopSeller };
  });

  return { items, counts, topThreshold };
}

/** 표 기본 정렬: 판정 심각도 순, 같은 판정 안에서는 빨리 소진되는 순 → 판매량 많은 순 */
export function compareByUrgency(a: InventoryItem, b: InventoryItem): number {
  const v = VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict);
  if (v !== 0) return v;
  const da = a.daysLeft ?? Infinity;
  const db = b.daysLeft ?? Infinity;
  if (da !== db) return da - db;
  return b.sales - a.sales;
}
