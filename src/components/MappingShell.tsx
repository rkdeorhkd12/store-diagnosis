import type { ReactNode } from 'react';
import type { ParsedSheet } from '../types';

/** 판매·재고 열 매칭 화면이 함께 쓰는 틀: 제목, 항목 목록, 원본 미리보기, 버튼 */
export function MappingShell({
  sheet,
  missingCount,
  onBack,
  onSubmit,
  error,
  children,
}: {
  sheet: ParsedSheet;
  missingCount: number;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <section className="stack">
      <div className="card stack">
        <div>
          <h2>열 매칭</h2>
          <p className="muted small">
            <strong>{sheet.fileName}</strong> · {sheet.rows.length.toLocaleString('ko-KR')}줄 ·{' '}
            {sheet.headers.length}개 열. 열 이름을 보고 자동으로 추천했어요. 다르면 바꿔 주세요.
          </p>
        </div>
        <div className="field-list">{children}</div>
      </div>

      <details className="card preview">
        <summary>원본 미리보기 (앞 3줄)</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {sheet.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(0, 3).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>
          다른 파일
        </button>
        <button className="btn btn-primary" onClick={onSubmit} disabled={missingCount > 0}>
          {missingCount > 0 ? `필수 항목 ${missingCount}개 남음` : '진단하기'}
        </button>
      </div>
    </section>
  );
}

/** 한 항목 ↔ 열 드롭다운. 고른 열의 첫 값을 예시로 보여 준다. */
export function MappingField({
  id,
  label,
  required,
  value,
  sheet,
  help,
  onChange,
  before,
  after,
}: {
  id: string;
  label: string;
  required: boolean;
  value: number | null;
  sheet: ParsedSheet;
  help: string;
  onChange: (col: number | null) => void;
  /** 드롭다운 위에 놓을 추가 컨트롤 (예: 금액 계산 방식) */
  before?: ReactNode;
  /** 설명 아래에 놓을 경고 등 */
  after?: ReactNode;
}) {
  const sample = value === null ? '' : sheet.rows.find((r) => r[value] !== '')?.[value] ?? '';
  return (
    <div className="field">
      <label className="field-label" htmlFor={`map-${id}`}>
        {label}
        <span className={required ? 'badge badge-req' : 'badge'}>{required ? '필수' : '선택'}</span>
      </label>
      {before}
      <select
        id={`map-${id}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={required && value === null ? 'is-missing' : ''}
      >
        <option value="">{required ? '— 열을 선택하세요 —' : '— 사용 안 함 —'}</option>
        {sheet.headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </select>
      {value !== null && (
        <p className="field-sample small">
          예: <span>{sample || '(빈 값)'}</span>
        </p>
      )}
      <p className="muted small">{help}</p>
      {after}
    </div>
  );
}
