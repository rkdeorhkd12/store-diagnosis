export type Mode = 'sales' | 'inventory';

const MODES: { mode: Mode; icon: string; title: string; file: string; points: string[] }[] = [
  {
    mode: 'sales',
    icon: '📈',
    title: '판매 진단',
    file: '쇼핑몰 주문 엑셀',
    points: ['매출 상위·하위 상품', '기간별 매출 추이', '컬러별 판매 비중, 객단가'],
  },
  {
    mode: 'inventory',
    icon: '📦',
    title: '재고 진단',
    file: '판매·재고 표 (이지어드민 등에서 가공)',
    points: ['옵션별 부족·소진임박 판정', '리오더 우선 목록', '예상 소진일'],
  },
];

export default function ModeSelect({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <section className="stack">
      <h2>무엇을 진단할까요?</h2>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.mode} type="button" className="mode-card" onClick={() => onSelect(m.mode)}>
            <span className="mode-icon" aria-hidden>
              {m.icon}
            </span>
            <span className="mode-title">{m.title}</span>
            <span className="muted small">{m.file}</span>
            <ul className="mode-points">
              {m.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <span className="mode-go">시작하기 →</span>
          </button>
        ))}
      </div>
      <div className="privacy">
        <strong>🔒 파일은 외부로 전송되지 않습니다.</strong>
        <span className="muted small">모든 분석은 지금 보고 계신 브라우저 안에서만 이루어집니다.</span>
      </div>
    </section>
  );
}
