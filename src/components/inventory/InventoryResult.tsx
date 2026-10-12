import { useMemo, useRef, useState } from 'react';
import {
  compareByUrgency,
  DEFAULT_CRITERIA,
  judgeInventory,
  normalizeCriteria,
  VERDICT_LABEL,
  VERDICT_ORDER,
} from '../../lib/inventory';
import { formatCount } from '../../lib/normalize';
import type { InventoryBuildResult, InventoryCriteria, InventoryItem, Verdict } from '../../types';
import CriteriaPanel from './CriteriaPanel';

const CRITERIA_KEY = 'store-diagnosis:inventory-criteria';

/** 기준 숫자는 이 브라우저에만 기억해 둔다 (다음 방문 때 편하도록). */
function loadCriteria(): InventoryCriteria {
  try {
    const saved = JSON.parse(localStorage.getItem(CRITERIA_KEY) ?? 'null');
    if (saved && typeof saved === 'object') return normalizeCriteria({ ...DEFAULT_CRITERIA, ...saved });
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  return DEFAULT_CRITERIA;
}
function saveCriteria(c: InventoryCriteria) {
  try {
    localStorage.setItem(CRITERIA_KEY, JSON.stringify(c));
  } catch {
    /* 무시 */
  }
}

const VERDICT_HINT: Record<Verdict, string> = {
  reorder: '부족 + 판매량 상위',
  short: '1주치 미만',
  soon: '2주치 미만',
  check: '재고 음수 등',
  ok: '충분',
};

export function formatDays(d: number | null): string {
  if (d === null) return '—';
  if (d === 0) return '0일 (품절)';
  return d < 10 ? `${d.toFixed(1)}일` : `${Math.round(d)}일`;
}

export function VerdictBadge({ verdict, title }: { verdict: Verdict; title?: string }) {
  return (
    <span className={`verdict verdict-${verdict}`} title={title}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

type SortKey = 'urgency' | 'name' | 'sales' | 'stock' | 'weeklySales' | 'daysLeft';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'urgency', label: '판정' },
  { key: 'name', label: '상품 / 옵션' },
  { key: 'sales', label: '판매량', numeric: true },
  { key: 'stock', label: '현재 재고', numeric: true },
  { key: 'weeklySales', label: '주간 판매', numeric: true },
  { key: 'daysLeft', label: '예상 소진일', numeric: true },
];

function compare(key: SortKey, a: InventoryItem, b: InventoryItem): number {
  switch (key) {
    case 'urgency':
      return compareByUrgency(a, b);
    case 'name':
      return `${a.productName} ${a.option}`.localeCompare(`${b.productName} ${b.option}`, 'ko');
    case 'daysLeft':
      // 계산할 수 없는 값(—)은 오름차순에서 맨 뒤
      return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
    default:
      return a[key] - b[key];
  }
}

export default function InventoryResult({
  built,
  locationMapped,
  sourceFile,
}: {
  built: InventoryBuildResult;
  locationMapped: boolean;
  /** 엑셀 내려받기의 "판정 기준" 시트에 적는 원본 파일 이름 */
  sourceFile: string;
}) {
  const [criteria, setCriteriaState] = useState<InventoryCriteria>(loadCriteria);
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'urgency', dir: 1 });
  const tableRef = useRef<HTMLElement>(null);

  const setCriteria = (c: InventoryCriteria) => {
    setCriteriaState(c);
    saveCriteria(c);
  };

  const applied = normalizeCriteria(criteria);
  const diagnosis = useMemo(() => judgeInventory(built.items, criteria), [built.items, criteria]);
  const reorder = useMemo(
    () => diagnosis.items.filter((i) => i.verdict === 'reorder').sort(compareByUrgency),
    [diagnosis.items],
  );
  const rows = useMemo(() => {
    const list = filter === 'all' ? diagnosis.items : diagnosis.items.filter((i) => i.verdict === filter);
    return [...list].sort((a, b) => compare(sort.key, a, b) * sort.dir || compareByUrgency(a, b));
  }, [diagnosis.items, filter, sort]);

  const merged = built.usedRows - built.items.length;
  const showLocation = locationMapped && diagnosis.items.some((i) => i.locations.length > 0);
  const hints: Record<Verdict, string> = {
    ...VERDICT_HINT,
    reorder: `부족 + 판매량 상위 ${formatCount(applied.topPercent)}%`,
    short: `${formatCount(applied.shortWeeks)}주치 미만`,
    soon: `${formatCount(applied.soonWeeks)}주치 미만`,
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /** 브라우저 안에서 xlsx를 만들어 바로 저장한다 (서버 전송 없음). */
  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const [XLSX, { buildReorderWorkbook, reorderFileName }] = await Promise.all([
        import('xlsx'),
        import('../../lib/exportReorder'),
      ]);
      const now = new Date();
      XLSX.writeFile(buildReorderWorkbook(XLSX, diagnosis.items, applied, { sourceFile, now }), reorderFileName(now));
    } catch {
      setDownloadError('엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  };

  const pickFilter = (v: Verdict) => {
    setFilter((f) => (f === v ? 'all' : v));
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || key === 'urgency' || key === 'daysLeft' ? 1 : -1 },
    );

  return (
    <>
      <section className="notice">
        <p>
          옵션 <strong>{formatCount(diagnosis.items.length)}개</strong> 판정 · 원본 {formatCount(built.usedRows)}줄
          {merged > 0 && <span className="muted"> · 로케이션별로 나뉜 {formatCount(merged)}줄을 옵션 단위로 합쳤습니다</span>}
          {built.skippedInvalid > 0 && (
            <>
              {' · '}값을 읽지 못해 건너뜀 <strong>{formatCount(built.skippedInvalid)}줄</strong>
            </>
          )}
        </p>
      </section>

      <CriteriaPanel criteria={criteria} applied={applied} onChange={setCriteria} onReset={() => setCriteria(DEFAULT_CRITERIA)} />

      <section className="verdict-grid" aria-label="판정별 개수">
        {VERDICT_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            className={`verdict-card verdict-card-${v}${filter === v ? ' is-active' : ''}`}
            aria-pressed={filter === v}
            onClick={() => pickFilter(v)}
          >
            <span className="verdict-card-label">
              <span className={`verdict-dot verdict-dot-${v}`} aria-hidden />
              {VERDICT_LABEL[v]}
            </span>
            <span className="verdict-card-count">{formatCount(diagnosis.counts[v])}</span>
            <span className="muted small">{hints[v]}</span>
          </button>
        ))}
      </section>

      <section className="card">
        <div className="card-head card-head-wrap">
          <h3>리오더 우선 {reorder.length > 0 && <span className="muted small">· 예상 소진일이 짧은 순</span>}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={download}
            disabled={reorder.length === 0 || downloading}
          >
            {downloading ? '만드는 중…' : '⬇ 엑셀로 내려받기'}
          </button>
        </div>
        {downloadError && <p className="error small">{downloadError}</p>}
        {reorder.length === 0 ? (
          <p className="muted small">
            판매량 상위 {formatCount(applied.topPercent)}% 상품 중 재고가 부족한 옵션이 없습니다. 위 판정 기준을
            바꿔 볼 수 있어요.
          </p>
        ) : (
          <ol className="reorder-list">
            {reorder.map((i) => (
              <li key={i.key}>
                <div className="reorder-main">
                  <span className="reorder-name">
                    {i.productName}
                    {i.option && <span className="muted"> · {i.option}</span>}
                  </span>
                  <span className="reorder-days">{formatDays(i.daysLeft)}</span>
                </div>
                <p className="muted small">
                  재고 {formatCount(i.stock)} · 주간 판매 {formatCount(i.weeklySales)} · 판매량 {formatCount(i.sales)} (
                  {i.salesRank}위)
                  {i.locations.length > 0 && ` · ${i.locations.join(', ')}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card" ref={tableRef}>
        <div className="card-head card-head-wrap">
          <h3>전체 옵션</h3>
          <span className="muted small">{formatCount(rows.length)}개 표시</span>
        </div>

        {/* 모바일에서는 표 머리글이 숨겨지므로 정렬을 드롭다운으로 고른다. */}
        <label className="mobile-sort small">
          정렬
          <select
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':');
              setSort({ key: key as SortKey, dir: Number(dir) as 1 | -1 });
            }}
          >
            <option value="urgency:1">긴급한 순 (판정)</option>
            <option value="daysLeft:1">예상 소진일 짧은 순</option>
            <option value="sales:-1">판매량 많은 순</option>
            <option value="stock:1">재고 적은 순</option>
            <option value="weeklySales:-1">주간 판매 많은 순</option>
            <option value="name:1">상품명 순</option>
          </select>
        </label>

        <div className="chips" role="group" aria-label="판정 필터">
          {(['all', ...VERDICT_ORDER] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${filter === v ? ' is-on' : ''}`}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v === 'all' ? '전체' : VERDICT_LABEL[v]}{' '}
              <span className="chip-count">
                {formatCount(v === 'all' ? diagnosis.items.length : diagnosis.counts[v])}
              </span>
            </button>
          ))}
        </div>

        <div className="table-scroll inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.numeric ? 'num' : undefined}
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="sort-mark" aria-hidden>
                        {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                ))}
                {showLocation && <th>로케이션</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                // 좁은 화면에서는 CSS로 행을 카드처럼 쌓는다. data-label이 숫자 앞 이름표가 된다.
                <tr key={i.key}>
                  <td className="inv-verdict">
                    <VerdictBadge verdict={i.verdict} title={i.reason} />
                  </td>
                  <td className="inv-name" title={i.reason}>
                    {i.productName}
                    {i.option && <span className="muted"> · {i.option}</span>}
                    {/* 데스크톱에서는 툴팁, 터치 화면(카드형)에서는 이 줄로 이유를 보여 준다 */}
                    <span className="inv-reason">{i.reason}</span>
                  </td>
                  <td className="num" data-label="판매">
                    {formatCount(i.sales)}
                    {i.isTopSeller && <span className="top-mark" title="판매량 상위">★</span>}
                  </td>
                  <td className={`num${i.stock < 0 ? ' neg' : ''}`} data-label="재고">
                    {formatCount(i.stock)}
                  </td>
                  <td className="num" data-label="주간">
                    {formatCount(i.weeklySales)}
                  </td>
                  <td className="num inv-days" data-label="소진">
                    {formatDays(i.daysLeft)}
                  </td>
                  {showLocation && (
                    <td className="muted inv-loc" data-label="위치">
                      {i.locations.join(', ') || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small table-foot">
          판정 이유는 행에 마우스를 올리면 볼 수 있습니다. 예상 소진일 = 현재 재고 ÷ 주간 판매량 × 7. ★ 판매량 상위 {formatCount(applied.topPercent)}%
          {diagnosis.topThreshold !== null && ` (판매량 ${formatCount(diagnosis.topThreshold)} 이상)`}.
        </p>
      </section>
    </>
  );
}
