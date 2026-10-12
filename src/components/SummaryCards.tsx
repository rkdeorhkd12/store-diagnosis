import { formatCount, formatWon } from '../lib/normalize';
import type { DiagnosisResult } from '../types';

export default function SummaryCards({ result }: { result: DiagnosisResult }) {
  return (
    <section className="summary-grid" aria-label="요약">
      <div className="stat stat-hero">
        <p className="stat-label">
          객단가 <span className="badge">배송비 제외 기준</span>
        </p>
        <p className="stat-value">{formatWon(result.averageOrderValue)}</p>
        <p className="muted small">상품금액 합계 ÷ 주문 {formatCount(result.orderCount)}건</p>
      </div>
      <div className="stat">
        <p className="stat-label">상품 매출</p>
        <p className="stat-value">{formatWon(result.totalRevenue)}</p>
        <p className="muted small">배송비 제외</p>
      </div>
      <div className="stat">
        <p className="stat-label">주문 수</p>
        <p className="stat-value">{formatCount(result.orderCount)}건</p>
        <p className="muted small">고유 주문번호 기준</p>
      </div>
      <div className="stat">
        <p className="stat-label">판매 수량</p>
        <p className="stat-value">{formatCount(result.totalQuantity)}개</p>
        <p className="muted small">상품 {formatCount(result.productCount)}종</p>
      </div>
    </section>
  );
}
