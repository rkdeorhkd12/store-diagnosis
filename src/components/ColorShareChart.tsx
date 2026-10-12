import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCount, formatWon } from '../lib/normalize';
import { UNSPECIFIED_COLOR } from '../lib/parseOption';
import type { ColorStat } from '../types';

type Basis = 'quantity' | 'revenue';

const MAX_SLICES = 7;
const OTHERS = '기타';

/** 컬러 이름을 실제 색으로 보여 주면 셀러가 바로 알아본다. 모르는 이름은 팔레트에서 고른다. */
const NAMED: [RegExp, string][] = [
  [/블랙|검정|black/i, '#1f1f1f'],
  [/화이트|흰|white|오프화이트/i, '#f4f4f0'],
  [/아이보리|ivory|크림|cream/i, '#efe6cf'],
  [/그레이|회색|gray|grey|차콜|charcoal/i, '#8b8f94'],
  [/네이비|navy|곤색/i, '#1e2f5c'],
  [/블루|파랑|blue|하늘|소라/i, '#3b7dd8'],
  [/베이지|beige|샌드|sand/i, '#d8c3a0'],
  [/브라운|갈색|brown|카멜|camel|모카/i, '#8a5a3b'],
  [/카키|khaki|올리브|olive/i, '#7a7a45'],
  [/그린|초록|green|민트|mint/i, '#3f9b6b'],
  [/레드|빨강|red|버건디|와인/i, '#c8373b'],
  [/핑크|분홍|pink/i, '#e98fb0'],
  [/옐로|노랑|yellow|머스타드/i, '#e6be3a'],
  [/퍼플|보라|purple|라벤더/i, '#8a63c4'],
  [/오렌지|주황|orange/i, '#e8803a'],
];
const FALLBACK = ['#5b8def', '#e07a5f', '#3d9970', '#b07cc6', '#f2a541', '#4ab3c4', '#c2649a'];
const NEUTRAL = '#b8bcc2';
const LIGHT = new Set(['#f4f4f0', '#efe6cf']);

function swatch(name: string, i: number): string {
  if (name === OTHERS || name === UNSPECIFIED_COLOR) return NEUTRAL;
  return NAMED.find(([re]) => re.test(name))?.[1] ?? FALLBACK[i % FALLBACK.length];
}

export default function ColorShareChart({ colors, optionMapped }: { colors: ColorStat[]; optionMapped: boolean }) {
  const [basis, setBasis] = useState<Basis>('quantity');

  const sorted = [...colors].sort((a, b) => b[basis] - a[basis]);
  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);
  const slices =
    tail.length > 0
      ? [
          ...head,
          {
            color: OTHERS,
            quantity: tail.reduce((s, c) => s + c.quantity, 0),
            revenue: tail.reduce((s, c) => s + c.revenue, 0),
          },
        ]
      : head;
  const data = slices
    .map((c, i) => ({ name: c.color, value: Math.max(c[basis], 0), fill: swatch(c.color, i) }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => (basis === 'quantity' ? `${formatCount(v)}개` : formatWon(v));
  const pct = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%');

  const onlyUnspecified = data.length === 1 && data[0].name === UNSPECIFIED_COLOR;

  return (
    <section className="card">
      <div className="card-head">
        <h3>컬러별 판매 비중</h3>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="비중 기준">
          {(['quantity', 'revenue'] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              className={basis === b ? 'is-on' : ''}
              onClick={() => setBasis(b)}
            >
              {b === 'quantity' ? '수량' : '매출'}
            </button>
          ))}
        </div>
      </div>

      {!optionMapped || onlyUnspecified ? (
        <p className="muted small">
          {optionMapped
            ? '옵션 값에서 컬러를 찾지 못했습니다. 옵션 열이 맞는지 확인해 주세요.'
            : '옵션 열을 매칭하면 컬러별 비중을 볼 수 있습니다.'}
        </p>
      ) : (
        <div className="color-layout">
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="92%"
                  paddingAngle={1}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.fill}
                      // 흰색·아이보리 조각이 배경에 묻히지 않게 테두리를 준다.
                      {...(LIGHT.has(d.fill) && { stroke: 'var(--border)', strokeWidth: 1 })}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [`${fmt(v)} (${pct(v)})`, n]}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                  }}
                  itemStyle={{ color: 'var(--text)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="muted small">{basis === 'quantity' ? '총 수량' : '총 매출'}</span>
              <strong>{fmt(total)}</strong>
            </div>
          </div>

          <ul className="legend">
            {data.map((d) => (
              <li key={d.name}>
                <span className="legend-swatch" style={{ background: d.fill }} />
                <span className="legend-name">{d.name}</span>
                <span className="legend-value">{fmt(d.value)}</span>
                <span className="legend-pct">{pct(d.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
