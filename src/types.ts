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
