/**
 * 금액·수량 문자열을 숫자로 바꾼다.
 * "12,900원" → 12900, "₩ 1,000" → 1000, "(1,000)" → -1000, "" → NaN
 */
export function toNumber(value: string): number {
  const text = value.trim();
  if (text === '') return NaN;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return NaN;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

const EXCLUDED_STATUS = /취소|반품|환불/;

/** 주문상태 값이 취소·반품·환불을 포함하면 true */
export function isExcludedStatus(status: string): boolean {
  return EXCLUDED_STATUS.test(status);
}

export function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}
