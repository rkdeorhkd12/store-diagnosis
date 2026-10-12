import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount, formatWon } from '../lib/normalize';
import { buildTrend, type Granularity, type TrendPoint } from '../lib/trend';
import { dayToDate } from '../lib/dates';
import type { DatedLine } from '../types';

type Metric = 'revenue' | 'orders';

const UNIT: Record<Granularity, string> = { day: '일', week: '주', month: '월' };
/** 일별 막대가 너무 많아지면 읽을 수 없으므로 석 달까지만 허용한다. */
const MAX_DAILY_SPAN = 92;

/** 축 눈금용 짧은 금액: 1,200,000 → 120만 */
function compactWon(n: number): string {
  if (n >= 100_000_000) return `${+(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${+(n / 10_000).toFixed(1)}만`;
  return formatCount(n);
}

const shortDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 툴팁·표용 기간 표기: 일별 "10/1 (목)", 주·월별 "10/5 ~ 10/11" */
function periodText(p: TrendPoint, g: Granularity): string {
  if (g !== 'day') return `${shortDay(p.start)} ~ ${shortDay(p.end)}`;
  const weekday = '일월화수목금토'[dayToDate(p.start).getUTCDay()];
  return `${shortDay(p.start)} (${weekday})`;
}

interface Props {
  lines: DatedLine[];
  undatedRows: number;
  dateMapped: boolean;
}

export default function SalesTrendChart({ lines, undatedRows, dateMapped }: Props) {
  const auto = useMemo(() => buildTrend(lines), [lines]);
  const [granularity, setGranularity] = useState<Granularity | null>(null);
  const [metric, setMetric] = useState<Metric>('revenue');

  // 사용자가 고른 단위가 새 데이터에 맞지 않으면(기간이 길어 일별 불가) 자동 단위로 돌아간다.
  const dailyAllowed = (auto?.spanDays ?? 0) <= MAX_DAILY_SPAN;
  const g = granularity && (granularity !== 'day' || dailyAllowed) ? granularity : auto?.granularity ?? 'day';
  const trend = useMemo(() => (auto ? buildTrend(lines, g) : null), [lines, g, auto]);

  if (!dateMapped || !trend || !auto) {
    return (
      <section className="card">
        <h3>기간별 매출 추이</h3>
        <p className="muted small">
          {dateMapped
            ? '주문일시 값에서 날짜를 읽지 못했습니다. 열 매칭에서 주문일시 열이 맞는지 확인해 주세요.'
            : '열 매칭에서 주문일시 열을 고르면 일·주·월별 매출 추이를 볼 수 있습니다.'}
        </p>
      </section>
    );
  }

  const fmt = (v: number) => (metric === 'revenue' ? formatWon(v) : `${formatCount(v)}건`);
  const values = trend.points.map((p) => p[metric]);
  const total = values.reduce((s, v) => s + v, 0);
  const peakIdx = values.indexOf(Math.max(...values));
  const peak = trend.points[peakIdx];
  const average = total / trend.points.length;
  const span = trend.spanDays;
  const many = trend.points.length > 14;

  return (
    <section className="card">
      <div className="card-head card-head-wrap">
        <h3>기간별 {metric === 'revenue' ? '매출' : '주문 수'} 추이</h3>
        <div className="row-gap">
          <div className="segmented segmented-sm" role="radiogroup" aria-label="집계 단위">
            {(['day', 'week', 'month'] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={g === u}
                className={g === u ? 'is-on' : ''}
                disabled={u === 'day' && !dailyAllowed}
                title={u === 'day' && !dailyAllowed ? '기간이 석 달을 넘어 일별은 볼 수 없습니다' : undefined}
                onClick={() => setGranularity(u)}
              >
                {UNIT[u]}별
              </button>
            ))}
          </div>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="지표">
            {(['revenue', 'orders'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                className={metric === m ? 'is-on' : ''}
                onClick={() => setMetric(m)}
              >
                {m === 'revenue' ? '매출' : '주문 수'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="muted small">
        {trend.firstDay.replace(/-/g, '.')} ~ {trend.lastDay.replace(/-/g, '.')} · {span}일
        {metric === 'revenue' && ' · 배송비 제외'}
      </p>

      <dl className="trend-stats">
        <div>
          <dt>최고 {UNIT[g]}</dt>
          <dd>
            {fmt(peak[metric])} <span className="muted small">{periodText(peak, g)}</span>
          </dd>
        </div>
        <div>
          <dt>{UNIT[g]} 평균</dt>
          <dd>
            {metric === 'revenue'
              ? formatWon(average)
              : `${average.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}건`}
          </dd>
        </div>
      </dl>

      <div className="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend.points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={many ? 2 : '24%'}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickFormatter={(v: number) => (metric === 'revenue' ? compactWon(v) : formatCount(v))}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TrendPoint;
                return (
                  <div className="chart-tooltip">
                    <strong>{periodText(p, g)}</strong>
                    <span>매출 {formatWon(p.revenue)}</span>
                    <span>
                      주문 {formatCount(p.orders)}건 · {formatCount(p.quantity)}개
                    </span>
                  </div>
                );
              }}
            />
            <Bar
              dataKey={metric}
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {undatedRows > 0 && (
        <p className="muted small">
          날짜를 읽지 못한 {formatCount(undatedRows)}줄은 추이에서 빠졌습니다. 위쪽 합계에는 포함됩니다.
        </p>
      )}

      <details className="trend-table">
        <summary className="small">표로 보기</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>기간</th>
                <th>매출</th>
                <th>주문</th>
                <th>수량</th>
              </tr>
            </thead>
            <tbody>
              {trend.points.map((p) => (
                <tr key={p.start}>
                  <td>{periodText(p, g)}</td>
                  <td className="num">{formatWon(p.revenue)}</td>
                  <td className="num">{formatCount(p.orders)}건</td>
                  <td className="num">{formatCount(p.quantity)}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
