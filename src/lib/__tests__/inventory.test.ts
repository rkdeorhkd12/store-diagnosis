import { describe, expect, it } from 'vitest';
import { guessInventoryMapping } from '../guessMapping';
import {
  buildInventory,
  compareByUrgency,
  daysLeft,
  DEFAULT_CRITERIA,
  judgeInventory,
  normalizeCriteria,
} from '../inventory';
import type { InventoryBase, InventoryMapping, ParsedSheet, Verdict } from '../../types';
import { loadCsv } from './helpers';

/** 테스트용 옵션 한 줄 */
const item = (name: string, sales: number, stock: number, weeklySales: number): InventoryBase => ({
  key: name, productName: name, option: '', locations: [], sales, stock, weeklySales, sourceRows: 1,
});
const verdictOf = (base: InventoryBase[], name: string, c = DEFAULT_CRITERIA) =>
  judgeInventory(base, c).items.find((i) => i.productName === name)!.verdict;

describe('judgeInventory: 기본 기준 (1주 / 2주 / 상위 20%)', () => {
  // 판매량 상위 20% = 10개 중 2개 → 판매량 100, 90
  const base = [
    item('상위-부족', 100, 5, 10),
    item('상위-정상', 90, 50, 10),
    item('부족', 50, 9, 10),
    item('부족-경계', 40, 9.99, 10),
    item('소진임박-경계', 30, 10, 10), // 재고 = 주간 판매 × 1 → 부족 아님
    item('소진임박', 20, 19, 10),
    item('정상-경계', 15, 20, 10), // 재고 = 주간 판매 × 2 → 소진임박 아님
    item('재고음수', 80, -2, 10),
    item('판매없음', 0, 0, 0),
    item('재고0-판매있음', 10, 0, 3),
  ];

  it.each<[string, Verdict]>([
    ['상위-부족', 'reorder'],
    ['상위-정상', 'ok'],
    ['부족', 'short'],
    ['부족-경계', 'short'],
    ['소진임박-경계', 'soon'],
    ['소진임박', 'soon'],
    ['정상-경계', 'ok'],
    ['재고음수', 'check'],
    ['판매없음', 'ok'],
    ['재고0-판매있음', 'short'],
  ])('%s → %s', (name, expected) => {
    expect(verdictOf(base, name)).toBe(expected);
  });

  it('판정은 서로 겹치지 않고 개수 합이 전체와 같다', () => {
    const { counts, items } = judgeInventory(base, DEFAULT_CRITERIA);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(items.length);
    expect(counts).toEqual({ reorder: 1, short: 3, soon: 2, check: 1, ok: 3 });
  });

  it('재고 음수는 상위 판매 상품이어도 데이터 확인 필요가 우선', () => {
    const b = [item('A', 100, -1, 50), item('B', 1, 0, 0)];
    expect(verdictOf(b, 'A', { ...DEFAULT_CRITERIA, topPercent: 50 })).toBe('check');
  });

  it('판매량이 음수여도 데이터 확인 필요', () => {
    expect(verdictOf([item('A', 5, 10, -2)], 'A')).toBe('check');
  });
});

describe('judgeInventory: 상위 N%', () => {
  it('ceil(n × N%)번째 판매량 이상이면 상위 (동점 포함)', () => {
    // 5개 × 20% = 1개 → 판매량 50 이상. 50이 두 개면 둘 다 상위.
    const base = [item('A', 50, 0, 5), item('B', 50, 0, 5), item('C', 10, 0, 5), item('D', 5, 0, 5), item('E', 1, 0, 5)];
    const r = judgeInventory(base, DEFAULT_CRITERIA);
    expect(r.topThreshold).toBe(50);
    expect(r.items.filter((i) => i.isTopSeller).map((i) => i.productName)).toEqual(['A', 'B']);
    expect(r.counts.reorder).toBe(2);
    expect(r.items.map((i) => i.salesRank)).toEqual([1, 1, 3, 4, 5]);
  });

  it('판매량 0은 상위로 치지 않는다', () => {
    const r = judgeInventory([item('A', 0, 0, 1), item('B', 0, 0, 1)], { ...DEFAULT_CRITERIA, topPercent: 100 });
    expect(r.topThreshold).toBeNull();
    expect(r.counts).toMatchObject({ reorder: 0, short: 2 });
  });

  it('0%면 리오더 우선이 없다', () => {
    const r = judgeInventory([item('A', 100, 0, 10)], { ...DEFAULT_CRITERIA, topPercent: 0 });
    expect(r.counts).toMatchObject({ reorder: 0, short: 1 });
  });
});

describe('기준 숫자 바꾸기', () => {
  const base = [item('A', 10, 15, 10)]; // 1.5주치

  it('부족 2주 / 소진임박 3주면 1.5주치 재고는 부족', () => {
    expect(verdictOf(base, 'A', { shortWeeks: 2, soonWeeks: 3, topPercent: 0 })).toBe('short');
  });
  it('부족 1주 / 소진임박 1.5주면 1.5주치 재고는 정상 (경계값은 정상)', () => {
    expect(verdictOf(base, 'A', { shortWeeks: 1, soonWeeks: 1.5, topPercent: 0 })).toBe('ok');
  });
  it('잘못된 기준은 쓸 수 있는 값으로 맞춘다', () => {
    expect(normalizeCriteria({ shortWeeks: 0, soonWeeks: 0.5, topPercent: 150 })).toEqual({
      shortWeeks: 1, soonWeeks: 2, topPercent: 100,
    });
    expect(normalizeCriteria({ shortWeeks: 3, soonWeeks: 2, topPercent: NaN })).toEqual({
      shortWeeks: 3, soonWeeks: 6, topPercent: 20,
    });
  });
});

describe('daysLeft', () => {
  it('재고 ÷ 주간 판매량 × 7', () => {
    expect(daysLeft(14, 7)).toBe(14);
    expect(daysLeft(18, 26)).toBeCloseTo(4.846, 3);
    expect(daysLeft(0, 5)).toBe(0);
  });
  it('주간 판매가 없거나 재고가 음수면 계산하지 않는다', () => {
    expect(daysLeft(10, 0)).toBeNull();
    expect(daysLeft(-3, 5)).toBeNull();
  });
});

describe('buildInventory', () => {
  const mapping: InventoryMapping = { productName: 0, option: 1, location: 2, sales: 3, stock: 4, weeklySales: 5 };

  it('같은 상품·옵션이 로케이션별로 나뉘면 합친다', () => {
    const sheet: ParsedSheet = {
      fileName: 't', headers: ['상품명', '옵션', '로케이션', '판매량', '재고', '주간'],
      rows: [
        ['티셔츠', '블랙/M', 'A-1', '10', '3', '4'],
        ['티셔츠', '블랙/M', 'B-2', '5', '2', '1'],
        ['티셔츠', '블랙/L', 'A-1', '7', '9', '2'],
      ],
    };
    const r = buildInventory(sheet, mapping);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ option: '블랙/M', sales: 15, stock: 5, weeklySales: 5, locations: ['A-1', 'B-2'], sourceRows: 2 });
  });

  it('숫자를 읽을 수 없거나 상품명이 없으면 건너뛴다', () => {
    const sheet: ParsedSheet = {
      fileName: 't', headers: [],
      rows: [['', 'x', '', '1', '1', '1'], ['티', 'x', '', '1', '', '1'], ['티', 'x', '', '1,000', '-3', '2']],
    };
    const r = buildInventory(sheet, mapping);
    expect(r.skippedInvalid).toBe(2);
    expect(r.items[0]).toMatchObject({ sales: 1000, stock: -3 });
  });

  it('옵션 열이 없으면 상품 단위로 판정한다', () => {
    const sheet: ParsedSheet = { fileName: 't', headers: [], rows: [['티', '', '', '1', '1', '1'], ['티', '', '', '2', '2', '2']] };
    expect(buildInventory(sheet, { ...mapping, option: null, location: null }).items).toHaveLength(1);
  });
});

describe('샘플 재고 데이터', () => {
  const sheet = loadCsv('sample-inventory.csv');
  const mapping = guessInventoryMapping(sheet.headers);

  it('열을 자동으로 매칭한다', () => {
    const name = (i: number | null) => (i === null ? null : sheet.headers[i]);
    expect({
      productName: name(mapping.productName), option: name(mapping.option), location: name(mapping.location),
      sales: name(mapping.sales), stock: name(mapping.stock), weeklySales: name(mapping.weeklySales),
    }).toEqual({
      productName: '상품명', option: '옵션', location: '로케이션',
      sales: '판매량(4주)', stock: '현재재고', weeklySales: '주간판매량',
    });
  });

  it('기본 기준 판정 개수', () => {
    const r = judgeInventory(buildInventory(sheet, mapping).items, DEFAULT_CRITERIA);
    expect(r.items).toHaveLength(25);
    expect(r.topThreshold).toBe(72); // 25 × 20% = 5개 → 120, 110, 96, 84, 72
    expect(r.counts).toEqual({ reorder: 3, short: 6, soon: 5, check: 3, ok: 8 });
    expect(
      r.items.filter((i) => i.verdict === 'reorder').map((i) => `${i.productName} ${i.option}`).sort(),
    ).toEqual(['베이직 반팔 티셔츠 블랙/M', '베이직 반팔 티셔츠 화이트/M', '코튼 양말 3종 블랙/FREE']);
  });

  it('상위 30%로 넓히면 판매량 68·52인 부족 옵션도 리오더 우선', () => {
    const r = judgeInventory(buildInventory(sheet, mapping).items, { ...DEFAULT_CRITERIA, topPercent: 30 });
    expect(r.topThreshold).toBe(52); // 25 × 30% = 7.5 → 8개
    expect(r.counts).toMatchObject({ reorder: 5, short: 4, check: 3 });
  });

  it('긴급한 순으로 정렬한다', () => {
    const r = judgeInventory(buildInventory(sheet, mapping).items, DEFAULT_CRITERIA);
    const sorted = [...r.items].sort(compareByUrgency);
    // 리오더 우선 3개가 맨 앞, 그 안에서는 예상 소진일이 짧은 순
    expect(sorted.slice(0, 3).map((i) => [i.option, i.daysLeft!.toFixed(1)])).toEqual([
      ['화이트/M', '3.3'], // 9 ÷ 19 × 7
      ['블랙/M', '4.8'], // 18 ÷ 26 × 7
      ['블랙/FREE', '6.3'], // 25 ÷ 28 × 7
    ]);
    expect(sorted[3].verdict).toBe('short');
    expect(sorted.at(-1)!.verdict).toBe('ok');
  });
});
