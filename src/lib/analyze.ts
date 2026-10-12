import type { ColorStat, ColumnMapping, DiagnosisResult, ParsedSheet, ProductStat } from '../types';
import { isExcludedStatus, toNumber } from './normalize';
import { extractColor, UNSPECIFIED_COLOR } from './parseOption';

export const REQUIRED_FIELDS = ['productName', 'quantity', 'amount', 'orderId'] as const;

export function missingRequired(mapping: ColumnMapping): string[] {
  return REQUIRED_FIELDS.filter((f) => mapping[f] === null);
}

/**
 * 같은 주문 안에서 서로 다른 상품 줄의 금액이 모두 같으면 주문 단위 금액이
 * 반복된 것일 수 있다. 여러 상품이 섞인 주문의 절반 이상이 그렇다면 의심한다.
 */
function detectRepeatedAmount(orders: Map<string, { name: string; amount: number }[]>): boolean {
  let mixed = 0;
  let repeated = 0;
  for (const lines of orders.values()) {
    if (lines.length < 2) continue;
    if (new Set(lines.map((l) => l.name)).size < 2) continue;
    mixed++;
    if (new Set(lines.map((l) => l.amount)).size === 1) repeated++;
  }
  return mixed >= 3 && repeated / mixed >= 0.5;
}

export function analyze(sheet: ParsedSheet, mapping: ColumnMapping): DiagnosisResult {
  const missing = missingRequired(mapping);
  if (missing.length > 0) throw new Error(`필수 항목이 매칭되지 않았습니다: ${missing.join(', ')}`);

  const col = mapping as ColumnMapping & Record<(typeof REQUIRED_FIELDS)[number], number>;
  const products = new Map<string, ProductStat & { orders: Set<string> }>();
  const colors = new Map<string, ColorStat>();
  const orderLines = new Map<string, { name: string; amount: number }[]>();

  let excludedByStatus = 0;
  let skippedInvalid = 0;
  let includedRows = 0;
  let totalRevenue = 0;
  let totalQuantity = 0;
  let lastOrderId = '';

  sheet.rows.forEach((row, i) => {
    // 병합 셀로 내보낸 엑셀은 주문번호가 첫 줄에만 있으므로 위 값을 이어받는다.
    const rawOrderId = row[col.orderId]?.trim() ?? '';
    const orderId = rawOrderId || lastOrderId || `__row_${i}`;
    if (rawOrderId) lastOrderId = rawOrderId;

    if (mapping.status !== null && isExcludedStatus(row[mapping.status] ?? '')) {
      excludedByStatus++;
      return;
    }

    const name = row[col.productName]?.trim() ?? '';
    const quantity = toNumber(row[col.quantity] ?? '');
    const amountCell = toNumber(row[col.amount] ?? '');
    const revenue = mapping.amountMode === 'unitPrice' ? amountCell * quantity : amountCell;

    if (!name || Number.isNaN(quantity) || Number.isNaN(revenue)) {
      skippedInvalid++;
      return;
    }

    includedRows++;
    totalRevenue += revenue;
    totalQuantity += quantity;

    const p = products.get(name) ?? { name, revenue: 0, quantity: 0, orderCount: 0, orders: new Set() };
    p.revenue += revenue;
    p.quantity += quantity;
    p.orders.add(orderId);
    products.set(name, p);

    const colorName = mapping.option !== null ? extractColor(row[mapping.option] ?? '') : UNSPECIFIED_COLOR;
    const c = colors.get(colorName) ?? { color: colorName, quantity: 0, revenue: 0 };
    c.quantity += quantity;
    c.revenue += revenue;
    colors.set(colorName, c);

    const lines = orderLines.get(orderId) ?? [];
    lines.push({ name, amount: amountCell });
    orderLines.set(orderId, lines);
  });

  const productList: ProductStat[] = [...products.values()].map(({ orders, ...rest }) => ({
    ...rest,
    orderCount: orders.size,
  }));

  const byRevenueDesc = [...productList].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
  const top5 = byRevenueDesc.slice(0, 5);
  const topNames = new Set(top5.map((p) => p.name));
  // 하위 5는 1개 이상 팔린 상품 중 상위 5와 겹치지 않는 것
  const bottom5 = [...productList]
    .filter((p) => p.quantity > 0 && !topNames.has(p.name))
    .sort((a, b) => a.revenue - b.revenue || a.quantity - b.quantity)
    .slice(0, 5);

  const orderCount = orderLines.size;

  return {
    totalRevenue,
    totalQuantity,
    orderCount,
    averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
    productCount: productList.length,
    top5,
    bottom5,
    colors: [...colors.values()].sort((a, b) => b.quantity - a.quantity),
    includedRows,
    excludedByStatus,
    skippedInvalid,
    repeatedAmountSuspected: mapping.amountMode === 'line' && detectRepeatedAmount(orderLines),
  };
}
