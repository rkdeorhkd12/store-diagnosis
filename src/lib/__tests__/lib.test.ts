import { describe, expect, it } from 'vitest';
import { analyze } from '../analyze';
import { guessMapping } from '../guessMapping';
import { isExcludedStatus, toNumber } from '../normalize';
import { toParsedSheet } from '../parseFile';
import { extractColor } from '../parseOption';
import type { ColumnMapping, ParsedSheet } from '../../types';
import { loadSample } from './helpers';

describe('toNumber', () => {
  it('금액 문자열을 숫자로 바꾼다', () => {
    expect(toNumber('12,900원')).toBe(12900);
    expect(toNumber('₩ 1,000')).toBe(1000);
    expect(toNumber('(1,000)')).toBe(-1000);
    expect(toNumber('-500')).toBe(-500);
    expect(toNumber('3')).toBe(3);
    expect(toNumber('')).toBeNaN();
    expect(toNumber('없음')).toBeNaN();
  });
});

describe('isExcludedStatus', () => {
  it('취소·반품·환불이 포함된 상태만 제외한다', () => {
    expect(isExcludedStatus('취소완료')).toBe(true);
    expect(isExcludedStatus('반품요청')).toBe(true);
    expect(isExcludedStatus('환불완료')).toBe(true);
    expect(isExcludedStatus('배송완료')).toBe(false);
    expect(isExcludedStatus('구매확정')).toBe(false);
  });
});

describe('extractColor', () => {
  it('여러 옵션 형식에서 컬러를 찾는다', () => {
    expect(extractColor('색상=블랙, 사이즈=M')).toBe('블랙');
    expect(extractColor('색상: 네이비 / 사이즈: L')).toBe('네이비');
    expect(extractColor('사이즈: S / 컬러: 화이트')).toBe('화이트');
    expect(extractColor('[COLOR]베이지/[SIZE]M')).toBe('베이지');
    expect(extractColor('블루/M')).toBe('블루');
    expect(extractColor('M/그레이')).toBe('그레이');
    expect(extractColor('사이즈: M')).toBe('미지정');
    expect(extractColor('')).toBe('미지정');
  });
});

describe('guessMapping', () => {
  it('카페24형 헤더에서 줄 단위 금액과 주문상태를 추천한다', () => {
    const headers = loadSample().headers;
    const m = guessMapping(headers);
    expect(headers[m.orderId!]).toBe('주문번호');
    expect(headers[m.productName!]).toBe('상품명');
    expect(headers[m.option!]).toBe('옵션정보');
    expect(headers[m.quantity!]).toBe('수량');
    expect(headers[m.amount!]).toBe('상품구매금액');
    expect(m.amountMode).toBe('line');
    expect(headers[m.status!]).toBe('주문상태');
  });

  it('줄 금액 열이 없으면 판매가 × 수량 방식을 추천한다', () => {
    const m = guessMapping(['주문번호', '상품명', '수량', '판매가', '결제금액']);
    expect(m.amountMode).toBe('unitPrice');
    expect(m.amount).toBe(3);
  });

  it('상품주문번호보다 주문번호를 고른다', () => {
    const m = guessMapping(['상품주문번호', '주문번호', '상품명']);
    expect(m.orderId).toBe(1);
  });
});

describe('analyze (샘플 데이터)', () => {
  const sheet = loadSample();
  const base = guessMapping(sheet.headers);

  it('취소·반품·환불 줄을 빼고 배송비 제외 기준으로 집계한다', () => {
    const r = analyze(sheet, base);
    expect(r.excludedByStatus).toBe(3);
    expect(r.includedRows).toBe(22);
    expect(r.orderCount).toBe(15);
    expect(r.totalRevenue).toBe(710700);
    expect(r.averageOrderValue).toBe(47380);
    expect(r.totalQuantity).toBe(28);
    expect(r.repeatedAmountSuspected).toBe(false);
  });

  it('상위 5와 겹치지 않는 하위 상품을 고른다', () => {
    const r = analyze(sheet, base);
    expect(r.top5.map((p) => p.name)).toEqual([
      '베이직 반팔 티셔츠',
      '와이드 데님 팬츠',
      '오버핏 후드집업',
      '린넨 셔츠',
      '니트 가디건',
    ]);
    expect(r.top5[0]).toMatchObject({ revenue: 199000, quantity: 10, orderCount: 6 });
    expect(r.bottom5.map((p) => p.name)).toEqual(['코튼 양말 3종', '버킷햇', '캔버스 에코백']);
  });

  it('컬러별 수량을 합산한다', () => {
    const r = analyze(sheet, base);
    const byColor = Object.fromEntries(r.colors.map((c) => [c.color, c.quantity]));
    expect(byColor).toEqual({ 블랙: 12, 화이트: 6, 베이지: 3, 네이비: 3, 블루: 2, 그레이: 1, 아이보리: 1 });
  });

  it('판매가 × 수량 방식도 같은 매출을 낸다', () => {
    const priceCol = sheet.headers.indexOf('판매가');
    const r = analyze(sheet, { ...base, amount: priceCol, amountMode: 'unitPrice' });
    expect(r.totalRevenue).toBe(710700);
  });

  it('주문상태를 매칭하지 않으면 아무 줄도 제외하지 않는다', () => {
    const r = analyze(sheet, { ...base, status: null });
    expect(r.excludedByStatus).toBe(0);
    expect(r.includedRows).toBe(25);
  });

  it('주문 단위 결제금액을 줄 금액으로 고르면 경고한다', () => {
    const payCol = sheet.headers.indexOf('총 결제금액');
    const r = analyze(sheet, { ...base, amount: payCol, amountMode: 'line' });
    expect(r.repeatedAmountSuspected).toBe(true);
  });
});

describe('analyze (엣지 케이스)', () => {
  const mapping: ColumnMapping = {
    orderId: 0, productName: 1, quantity: 2, amount: 3, option: null, status: null, orderDate: null, amountMode: 'line',
  };

  it('주문번호가 첫 줄에만 있으면 이어받는다', () => {
    const sheet: ParsedSheet = {
      fileName: 't', headers: ['주문번호', '상품명', '수량', '금액'],
      rows: [['A1', '가', '1', '1000'], ['', '나', '1', '2000'], ['A2', '가', '1', '1000']],
    };
    const r = analyze(sheet, mapping);
    expect(r.orderCount).toBe(2);
    expect(r.averageOrderValue).toBe(2000);
  });

  it('상품명이나 금액이 비면 건너뛰고 개수를 센다', () => {
    const sheet: ParsedSheet = {
      fileName: 't', headers: ['주문번호', '상품명', '수량', '금액'],
      rows: [['A1', '', '1', '1000'], ['A2', '가', '1', ''], ['A3', '가', '1', '500']],
    };
    const r = analyze(sheet, mapping);
    expect(r.skippedInvalid).toBe(2);
    expect(r.includedRows).toBe(1);
  });

  const sheetWith = (n: number): ParsedSheet => ({
    fileName: 't', headers: ['주문번호', '상품명', '수량', '금액'],
    rows: Array.from({ length: n }, (_, i) => [`O${i}`, `상품${i + 1}`, '1', String((i + 1) * 1000)]),
  });

  it.each([1, 3, 5, 6, 7, 9, 10, 12])('상품 %i개일 때 상위·하위 목록이 겹치지 않는다', (n) => {
    const r = analyze(sheetWith(n), mapping);
    const top = new Set(r.top5.map((p) => p.name));
    expect(r.bottom5.some((p) => top.has(p.name))).toBe(false);
    expect(r.top5.length).toBe(Math.min(n, 5));
    expect(r.bottom5.length).toBe(Math.min(Math.max(n - 5, 0), 5));
  });

  it('상품 7개면 하위 목록은 매출이 가장 낮은 나머지 2개', () => {
    const r = analyze(sheetWith(7), mapping);
    expect(r.bottom5.map((p) => p.name)).toEqual(['상품1', '상품2']);
  });

  it('필수 항목이 없으면 오류를 낸다', () => {
    expect(() => analyze({ fileName: 't', headers: [], rows: [] }, { ...mapping, amount: null })).toThrow();
  });
});

describe('toParsedSheet', () => {
  it('제목 줄을 건너뛰고 빈 행·합계 행을 지운다', () => {
    const s = toParsedSheet('t', [
      ['주문 목록'],
      ['주문번호', '상품명', '수량'],
      ['1', '가', '1'],
      ['', '', ''],
      ['합계', '', '1'],
    ]);
    expect(s.headers).toEqual(['주문번호', '상품명', '수량']);
    expect(s.rows).toEqual([['1', '가', '1']]);
  });

  it('중복·빈 헤더에 이름을 붙인다', () => {
    const s = toParsedSheet('t', [['금액', '', '금액'], ['1', '2', '3']]);
    expect(s.headers).toEqual(['금액', '열 2', '금액 (2)']);
  });
});
