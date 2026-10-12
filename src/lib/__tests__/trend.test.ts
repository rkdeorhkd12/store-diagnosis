import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { analyze } from '../analyze';
import { parseDay } from '../dates';
import { guessMapping } from '../guessMapping';
import { workbookToParsedSheet } from '../parseFile';
import { buildTrend, defaultGranularity } from '../trend';
import type { ColumnMapping, DatedLine, ParsedSheet } from '../../types';
import { loadSample } from './helpers';

describe('parseDay', () => {
  it('여러 날짜 형식을 YYYY-MM-DD로 바꾼다', () => {
    expect(parseDay('2026-10-01 09:12')).toBe('2026-10-01');
    expect(parseDay('2026.10.1')).toBe('2026-10-01');
    expect(parseDay('2026/10/01 오후 3:12:00')).toBe('2026-10-01');
    expect(parseDay('2026년 10월 1일')).toBe('2026-10-01');
    expect(parseDay('20261001')).toBe('2026-10-01');
    expect(parseDay('20261001093000')).toBe('2026-10-01');
    expect(parseDay('46296')).toBe('2026-10-01'); // 엑셀 일련번호
  });

  it('읽을 수 없는 값은 null', () => {
    expect(parseDay('')).toBeNull();
    expect(parseDay('어제')).toBeNull();
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('20261001-0000001')).toBeNull(); // 주문번호
  });
});

describe('guessMapping (주문일시)', () => {
  it('주문일시 열을 추천하고 배송일 같은 열은 고르지 않는다', () => {
    expect(guessMapping(['주문번호', '주문일시', '상품명']).orderDate).toBe(1);
    expect(guessMapping(['주문번호', '배송완료일', '결제일시']).orderDate).toBe(2);
    expect(guessMapping(['주문번호', '발송일']).orderDate).toBeNull();
  });
});

describe('analyze + buildTrend (샘플 데이터)', () => {
  const sheet = loadSample();
  const mapping = guessMapping(sheet.headers);

  it('취소·반품을 뺀 줄만 날짜별로 모은다', () => {
    expect(sheet.headers[mapping.orderDate!]).toBe('주문일시');
    const r = analyze(sheet, mapping);
    expect(r.datedLines).toHaveLength(22);
    expect(r.undatedRows).toBe(0);
  });

  it('11일치라 일별로 묶고, 합계는 전체 매출과 같다', () => {
    const t = buildTrend(analyze(sheet, mapping).datedLines)!;
    expect(t.granularity).toBe('day');
    expect(t.spanDays).toBe(11);
    expect(t.points).toHaveLength(11);
    expect(t.points.reduce((s, p) => s + p.revenue, 0)).toBe(710700);
    expect(t.points[0]).toMatchObject({ start: '2026-10-01', label: '10/1', revenue: 98700, orders: 2 });
    expect(t.points[7]).toMatchObject({ start: '2026-10-08', revenue: 108800, orders: 2 });
  });

  it('주별은 월요일 시작, 데이터 범위로 잘린 기간을 갖는다', () => {
    const t = buildTrend(analyze(sheet, mapping).datedLines, 'week')!;
    expect(t.points.map((p) => [p.label, p.start, p.end, p.revenue])).toEqual([
      ['9/28~', '2026-10-01', '2026-10-04', 347200],
      ['10/5~', '2026-10-05', '2026-10-11', 363500],
    ]);
  });

  it('주문일시를 매칭하지 않으면 추이 데이터가 없다', () => {
    const r = analyze(sheet, { ...mapping, orderDate: null });
    expect(r.datedLines).toHaveLength(0);
    expect(buildTrend(r.datedLines)).toBeNull();
  });
});

describe('buildTrend', () => {
  const line = (day: string, revenue: number, orderId = day): DatedLine => ({ day, revenue, quantity: 1, orderId });

  it('판매 없는 날도 0으로 채운다', () => {
    const t = buildTrend([line('2026-10-01', 100), line('2026-10-04', 50)])!;
    expect(t.points.map((p) => p.revenue)).toEqual([100, 0, 0, 50]);
  });

  it('기간이 길면 월별, 해가 바뀌면 연도를 붙인다', () => {
    expect(defaultGranularity(31)).toBe('day');
    expect(defaultGranularity(90)).toBe('week');
    expect(defaultGranularity(400)).toBe('month');
    const t = buildTrend([line('2025-11-15', 1), line('2026-02-03', 2)], 'month')!;
    expect(t.points.map((p) => p.label)).toEqual(['25년 11월', '25년 12월', '26년 1월', '26년 2월']);
  });

  it('같은 주문은 구간 안에서 한 번만 센다', () => {
    const t = buildTrend([line('2026-10-01', 1, 'A'), line('2026-10-01', 2, 'A'), line('2026-10-01', 3, 'B')])!;
    expect(t.points[0].orders).toBe(2);
  });
});

describe('xlsx 날짜 셀', () => {
  it('엑셀 날짜 서식 셀을 YYYY-MM-DD HH:MM으로 읽고, 병합 셀처럼 빈 날짜는 이어받는다', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['주문번호', '주문일시', '상품명', '수량', '상품금액'],
      ['A1', new Date(Date.UTC(2026, 9, 1, 9, 12)), '가', 1, 1000],
      ['', '', '나', 1, 2000],
      ['A2', new Date(Date.UTC(2026, 9, 3, 23, 50)), '가', 1, 1000],
    ], { cellDates: false, UTC: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const sheet: ParsedSheet = workbookToParsedSheet(XLSX, XLSX.read(buf, { type: 'array', cellNF: true }), 't.xlsx');

    expect(sheet.rows[0][1]).toBe('2026-10-01 09:12');
    const mapping: ColumnMapping = {
      orderId: 0, orderDate: 1, productName: 2, quantity: 3, amount: 4,
      option: null, status: null, amountMode: 'line',
    };
    const r = analyze(sheet, mapping);
    expect(r.datedLines.map((l) => l.day)).toEqual(['2026-10-01', '2026-10-01', '2026-10-03']);
  });
});
