/** 업로드한 파일을 읽은 결과. 모든 셀은 문자열로 정규화한다. */
export interface ParsedSheet {
  fileName: string;
  headers: string[];
  rows: string[][];
}

/**
 * 상품 매출을 계산하는 방식.
 * - line: 줄 단위 금액 열(상품구매금액 등)을 그대로 사용
 * - unitPrice: 판매가(단가) 열 × 수량
 */
export type AmountMode = 'line' | 'unitPrice';

/** 각 항목이 몇 번째 열인지. 매칭하지 않은 선택 항목은 null. */
export interface ColumnMapping {
  productName: number | null;
  option: number | null;
  quantity: number | null;
  amount: number | null;
  orderId: number | null;
  status: number | null;
  orderDate: number | null;
  amountMode: AmountMode;
}

/** 기간별 추이 집계용: 날짜를 읽을 수 있었던 집계 대상 줄 */
export interface DatedLine {
  day: string;
  orderId: string;
  revenue: number;
  quantity: number;
}

/* ───────── 재고 진단 ───────── */

/** 재고 표의 각 항목이 몇 번째 열인지. 매칭하지 않은 선택 항목은 null. */
export interface InventoryMapping {
  productName: number | null;
  option: number | null;
  /** 기간 판매량 (상위 N% 판단용) */
  sales: number | null;
  stock: number | null;
  weeklySales: number | null;
  location: number | null;
}

/** 리오더 우선 → 부족 → 소진임박 → 데이터 확인 필요 → 정상. 서로 겹치지 않는다. */
export type Verdict = 'reorder' | 'short' | 'soon' | 'check' | 'ok';

export interface InventoryCriteria {
  /** 재고 < 주간 판매량 × shortWeeks 이면 부족 */
  shortWeeks: number;
  /** 재고 < 주간 판매량 × soonWeeks 이면 소진임박 */
  soonWeeks: number;
  /** 판매량 상위 몇 %를 리오더 우선 대상으로 볼지 */
  topPercent: number;
}

/** 옵션(상품명+옵션) 단위로 합친 재고 한 줄 */
export interface InventoryBase {
  key: string;
  productName: string;
  option: string;
  locations: string[];
  sales: number;
  stock: number;
  weeklySales: number;
  /** 원본에서 합쳐진 줄 수 (로케이션별로 나뉜 경우 2 이상) */
  sourceRows: number;
}

export interface InventoryItem extends InventoryBase {
  verdict: Verdict;
  reason: string;
  /** 재고 ÷ 주간 판매량 × 7. 주간 판매가 없거나 재고가 음수면 null */
  daysLeft: number | null;
  /** 판매량 순위 (1부터, 같은 판매량은 같은 순위) */
  salesRank: number;
  isTopSeller: boolean;
}

export interface InventoryBuildResult {
  items: InventoryBase[];
  /** 집계에 쓴 원본 줄 수 */
  usedRows: number;
  /** 상품명이 없거나 숫자를 읽을 수 없어 건너뛴 줄 수 */
  skippedInvalid: number;
}

export interface InventoryDiagnosis {
  items: InventoryItem[];
  counts: Record<Verdict, number>;
  /** 상위 N%에 드는 최소 판매량 (상위 판매 상품이 없으면 null) */
  topThreshold: number | null;
}

export interface ProductStat {
  name: string;
  revenue: number;
  quantity: number;
  orderCount: number;
}

export interface ColorStat {
  color: string;
  quantity: number;
  revenue: number;
}

export interface DiagnosisResult {
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
  /** 상품금액 합계 / 고유 주문번호 수 (배송비 제외) */
  averageOrderValue: number;
  productCount: number;
  top5: ProductStat[];
  bottom5: ProductStat[];
  colors: ColorStat[];
  /** 집계에 들어간 줄 수 */
  includedRows: number;
  /** 주문상태가 취소/반품/환불이라 제외한 줄 수 */
  excludedByStatus: number;
  /** 상품명·금액이 비어 있거나 숫자로 읽을 수 없어 건너뛴 줄 수 */
  skippedInvalid: number;
  /** 주문일시 매칭 시, 날짜를 읽을 수 있었던 줄 (추이 차트용) */
  datedLines: DatedLine[];
  /** 주문일시를 매칭했지만 날짜를 읽지 못한 집계 대상 줄 수 */
  undatedRows: number;
  /** 줄 금액이 주문 단위로 반복되는 것으로 보일 때 true */
  repeatedAmountSuspected: boolean;
}
