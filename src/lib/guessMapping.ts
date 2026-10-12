import type { ColumnMapping, InventoryMapping } from '../types';

interface FieldRule {
  keywords: string[];
  exclude?: RegExp;
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const RULES = {
  orderId: {
    keywords: ['주문번호', 'orderno', 'orderid', 'ordernumber', '주문id'],
    exclude: /상품주문번호|품목|line|item/i,
  },
  productName: {
    keywords: ['상품명', '품명', '상품이름', 'productname', 'itemname', '상품'],
    exclude: /코드|번호|옵션|금액|가격|수량|id|code/i,
  },
  option: {
    keywords: ['옵션정보', '옵션명', '상품옵션', '옵션', 'option', '색상', '컬러'],
    exclude: /코드|번호|금액|가격|추가/i,
  },
  quantity: {
    keywords: ['수량', '주문수량', '구매수량', 'qty', 'quantity'],
    exclude: /취소|반품|재고/,
  },
  lineAmount: {
    keywords: [
      '상품구매금액',
      '상품별총주문금액',
      '총상품금액',
      '상품금액',
      '상품주문금액',
      '판매금액',
      '상품합계',
    ],
    exclude: /결제|배송|할인|쿠폰|적립|정산|수수료/,
  },
  unitPrice: {
    keywords: ['판매가', '판매단가', '상품가격', '상품가', '단가', 'price'],
    exclude: /결제|배송|할인|쿠폰|공급|원가|소비자|정가/,
  },
  orderDate: {
    keywords: ['주문일시', '주문일자', '주문일', '주문날짜', '주문시간', '결제일시', '결제일', 'orderdate', '일시', '날짜', 'date'],
    exclude: /배송|발송|출고|입금|취소|반품|교환|환불|확정|정산|수정|생년/,
  },
  status: {
    keywords: ['주문상태', '처리상태', '상품주문상태', '주문처리상태', '클레임상태', '상태', 'status'],
    exclude: /결제상태|배송상태|입금상태/,
  },
} satisfies Record<string, FieldRule>;

function score(header: string, rule: FieldRule): number {
  const h = norm(header);
  if (rule.exclude?.test(header)) return 0;
  let best = 0;
  rule.keywords.forEach((kw, k) => {
    const key = norm(kw);
    if (h === key) best = Math.max(best, 1000 - k);
    else if (h.includes(key)) best = Math.max(best, 500 - k * 10 - h.length);
  });
  return best;
}

function pick(headers: string[], rule: FieldRule, used: Set<number>): number | null {
  let bestIdx: number | null = null;
  let bestScore = 0;
  headers.forEach((h, i) => {
    if (used.has(i)) return;
    const s = score(h, rule);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  if (bestIdx !== null) used.add(bestIdx);
  return bestIdx;
}

/** 열 이름으로 매칭을 추천한다. 사용자가 화면에서 고칠 수 있다. */
export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<number>();
  const orderId = pick(headers, RULES.orderId, used);
  const orderDate = pick(headers, RULES.orderDate, used);
  const productName = pick(headers, RULES.productName, used);
  const quantity = pick(headers, RULES.quantity, used);
  const lineAmount = pick(headers, RULES.lineAmount, used);
  const unitPrice = lineAmount === null ? pick(headers, RULES.unitPrice, used) : null;
  const option = pick(headers, RULES.option, used);
  const status = pick(headers, RULES.status, used);

  return {
    productName,
    option,
    quantity,
    orderId,
    status,
    orderDate,
    amount: lineAmount ?? unitPrice,
    amountMode: lineAmount === null && unitPrice !== null ? 'unitPrice' : 'line',
  };
}

const INVENTORY_RULES = {
  // "주간판매량"이 그냥 "판매량"으로 잡히지 않도록 주간 판매를 먼저 고른다.
  weeklySales: {
    keywords: ['주간판매량', '주간판매', '주간판매수량', '주판매량', '최근7일판매', '7일판매', '주평균판매', 'weeklysales'],
  },
  sales: {
    keywords: ['판매량', '판매수량', '기간판매량', '누적판매량', '총판매량', '판매', 'sales', 'sold'],
    exclude: /주간|7일|주평균|일평균|금액|가격|단가|예정/,
  },
  stock: {
    keywords: ['현재재고', '가용재고', '정상재고', '재고수량', '현재고', '재고', 'stock', 'inventory'],
    exclude: /안전|예정|입고|출고|이동|불량|금액|일수/,
  },
  productName: RULES.productName,
  option: {
    keywords: ['옵션', '옵션명', '옵션정보', '상품옵션', 'option', 'sku옵션'],
    exclude: /코드|번호|금액|가격|추가/i,
  },
  location: {
    keywords: ['로케이션', '로케이션코드', '위치', '보관위치', '창고', '랙', 'location', 'loc'],
  },
} satisfies Record<string, FieldRule>;

/** 재고 표 열 이름으로 매칭을 추천한다. */
export function guessInventoryMapping(headers: string[]): InventoryMapping {
  const used = new Set<number>();
  const weeklySales = pick(headers, INVENTORY_RULES.weeklySales, used);
  const sales = pick(headers, INVENTORY_RULES.sales, used);
  const stock = pick(headers, INVENTORY_RULES.stock, used);
  const productName = pick(headers, INVENTORY_RULES.productName, used);
  const option = pick(headers, INVENTORY_RULES.option, used);
  const location = pick(headers, INVENTORY_RULES.location, used);
  return { productName, option, sales, stock, weeklySales, location };
}

/** 금액 방식에 맞는 열을 다시 추천한다 (사용자가 방식을 바꿨을 때). */
export function guessAmountColumn(
  headers: string[],
  mode: ColumnMapping['amountMode'],
  taken: (number | null)[],
): number | null {
  const used = new Set(taken.filter((v): v is number => v !== null));
  return pick(headers, mode === 'line' ? RULES.lineAmount : RULES.unitPrice, used);
}
