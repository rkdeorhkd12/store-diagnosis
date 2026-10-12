import { formatCount, formatWon } from '../lib/normalize';
import type { ProductStat } from '../types';

interface Props {
  title: string;
  note?: string;
  products: ProductStat[];
  total: number;
  tone?: 'high' | 'low';
}

export default function ProductRanking({ title, note, products, total, tone = 'high' }: Props) {
  const max = Math.max(...products.map((p) => p.revenue), 1);

  return (
    <section className="card">
      <h3>{title}</h3>
      {note && <p className="muted small ranking-note">{note}</p>}
      {products.length > 0 && (
        <ol className={`ranking ranking-${tone}`}>
          {products.map((p, i) => (
            <li key={p.name}>
              <span className="rank">{i + 1}</span>
              <div className="rank-body">
                <div className="rank-top">
                  <span className="rank-name" title={p.name}>
                    {p.name}
                  </span>
                  <span className="rank-revenue">{formatWon(p.revenue)}</span>
                </div>
                <div className="bar" aria-hidden>
                  <span style={{ width: `${(Math.max(p.revenue, 0) / max) * 100}%` }} />
                </div>
                <p className="muted small">
                  {formatCount(p.quantity)}개 · 주문 {formatCount(p.orderCount)}건 · 매출 비중{' '}
                  {total > 0 ? ((p.revenue / total) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
