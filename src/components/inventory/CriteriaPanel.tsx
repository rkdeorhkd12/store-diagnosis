import { useState } from 'react';
import { DEFAULT_CRITERIA } from '../../lib/inventory';
import { formatCount } from '../../lib/normalize';
import type { InventoryCriteria } from '../../types';

type Key = keyof InventoryCriteria;

const FIELDS: { key: Key; label: string; unit: string }[] = [
  { key: 'shortWeeks', label: '부족', unit: '주치 미만' },
  { key: 'soonWeeks', label: '소진임박', unit: '주치 미만' },
  { key: 'topPercent', label: '리오더 우선', unit: '% 상위' },
];

/**
 * 판정 기준 입력. 입력 중에는 글자를 그대로 두고, 숫자로 읽히면 바로 반영한다.
 * 실제로 적용된 값이 입력과 다르면(예: 소진임박 ≤ 부족) 이유를 알려 준다.
 */
export default function CriteriaPanel({
  criteria,
  applied,
  onChange,
  onReset,
}: {
  criteria: InventoryCriteria;
  applied: InventoryCriteria;
  onChange: (c: InventoryCriteria) => void;
  onReset: () => void;
}) {
  // 입력 칸 글자는 따로 들고 있는다. criteria로 매번 덮어쓰면 "1." 입력 중 "1"로 바뀌어 1.5를 칠 수 없다.
  const [text, setText] = useState<Record<Key, string>>(() => toText(criteria));
  const reset = () => {
    onReset();
    setText(toText(DEFAULT_CRITERIA));
  };

  const update = (key: Key, value: string) => {
    setText((t) => ({ ...t, [key]: value }));
    const n = Number(value);
    if (value.trim() !== '' && Number.isFinite(n)) onChange({ ...criteria, [key]: n });
  };

  const adjusted = FIELDS.filter((f) => applied[f.key] !== criteria[f.key]);
  const isDefault = FIELDS.every((f) => criteria[f.key] === DEFAULT_CRITERIA[f.key]);

  return (
    <section className="card criteria">
      <div className="card-head card-head-wrap">
        <h3>판정 기준</h3>
        <button type="button" className="btn-link" onClick={reset} disabled={isDefault}>
          기본값 (1주 · 2주 · 20%)
        </button>
      </div>
      <div className="criteria-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="criteria-field">
            <span className="criteria-label">{f.label}</span>
            <span className="criteria-input">
              {/* type="number"는 "1." 같은 입력 중간 값을 빈 값으로 돌려줘 소수 입력이 끊긴다 → 텍스트 + 숫자 키패드 */}
              <input
                type="text"
                inputMode="decimal"
                aria-label={`${f.label} 기준 (${f.unit})`}
                value={text[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                onBlur={() => setText(toText(criteria))}
              />
              <span className="muted small">{f.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="muted small">
        재고가 음수면 <strong>데이터 확인 필요</strong>. 그 외에는 재고가 주간 판매량의 {formatCount(applied.shortWeeks)}
        주치 미만이면 <strong>부족</strong>, {formatCount(applied.soonWeeks)}주치 미만이면 <strong>소진임박</strong>
        입니다. 부족 중 판매량 상위 {formatCount(applied.topPercent)}%는 <strong>리오더 우선</strong>으로 따로 모읍니다.
      </p>
      {adjusted.length > 0 && (
        <p className="warn small">
          {adjusted.map((f) => `${f.label} 기준을 ${formatCount(applied[f.key])}(으)로 적용했습니다`).join(', ')}.
          소진임박 기준은 부족 기준보다 커야 하고, 비율은 0~100% 사이여야 합니다.
        </p>
      )}
    </section>
  );
}

function toText(c: InventoryCriteria): Record<Key, string> {
  return { shortWeeks: String(c.shortWeeks), soonWeeks: String(c.soonWeeks), topPercent: String(c.topPercent) };
}
