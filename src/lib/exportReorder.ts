import type { InventoryCriteria, InventoryItem } from '../types';
import { compareByUrgency, normalizeCriteria } from './inventory';

type XlsxModule = typeof import('xlsx');
type WorkBook = import('xlsx').WorkBook;

/** 엑셀 열 순서와 머리글. 값은 숫자 그대로 넣어 엑셀에서 정렬·합계가 되게 한다. */
export function reorderHeaders(criteria: InventoryCriteria): string[] {
  const { soonWeeks } = normalizeCriteria(criteria);
  return [
    '순번',
    '상품명',
    '옵션',
    '로케이션',
    '판매량',
    '판매 순위',
    '현재 재고',
    '주간 판매량',
    '예상 소진일',
    `${formatWeeks(soonWeeks)}주치까지 부족 수량(참고)`,
    '판정 이유',
  ];
}

const formatWeeks = (n: number) => String(Math.round(n * 10) / 10);

/**
 * 리오더 우선 옵션을 엑셀 행으로 만든다. 화면의 리오더 우선 목록과 같은 순서(예상 소진일 짧은 순).
 * "부족 수량"은 소진임박 기준(기본 2주치) 재고를 채우려면 몇 개가 더 필요한지 — 발주량 참고용.
 */
export function reorderRows(items: InventoryItem[], criteria: InventoryCriteria): (string | number)[][] {
  const { soonWeeks } = normalizeCriteria(criteria);
  return items
    .filter((i) => i.verdict === 'reorder')
    .sort(compareByUrgency)
    .map((i, idx) => [
      idx + 1,
      i.productName,
      i.option,
      i.locations.join(', '),
      i.sales,
      i.salesRank,
      i.stock,
      i.weeklySales,
      i.daysLeft === null ? '' : Math.round(i.daysLeft * 10) / 10,
      Math.max(0, Math.ceil(i.weeklySales * soonWeeks - i.stock)),
      i.reason,
    ]);
}

/** 리오더우선_20261012.xlsx */
export function reorderFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `리오더우선_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.xlsx`;
}

/** 시트 1: 리오더 우선 목록, 시트 2: 어떤 기준·파일로 뽑았는지 */
export function buildReorderWorkbook(
  XLSX: XlsxModule,
  items: InventoryItem[],
  criteria: InventoryCriteria,
  meta: { sourceFile: string; now: Date },
): WorkBook {
  const applied = normalizeCriteria(criteria);
  const header = reorderHeaders(applied);
  const rows = reorderRows(items, applied);

  const list = XLSX.utils.aoa_to_sheet([header, ...rows]);
  list['!cols'] = [6, 22, 14, 14, 8, 9, 9, 11, 11, 22, 60].map((wch) => ({ wch }));
  list['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };

  const p = (n: number) => String(n).padStart(2, '0');
  const n = meta.now;
  const info = XLSX.utils.aoa_to_sheet([
    ['항목', '값'],
    ['원본 파일', meta.sourceFile],
    ['내려받은 시각', `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}`],
    ['리오더 우선 옵션 수', rows.length],
    ['부족 기준', `재고 < 주간 판매량 × ${formatWeeks(applied.shortWeeks)}주`],
    ['리오더 우선 기준', `부족이면서 판매량 상위 ${formatWeeks(applied.topPercent)}%`],
    ['예상 소진일', '현재 재고 ÷ 주간 판매량 × 7'],
    ['부족 수량(참고)', `주간 판매량 × ${formatWeeks(applied.soonWeeks)}주 − 현재 재고 (소진임박 기준까지 채우는 수량, 올림)`],
  ]);
  info['!cols'] = [{ wch: 20 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, list, '리오더 우선');
  XLSX.utils.book_append_sheet(wb, info, '판정 기준');
  return wb;
}
