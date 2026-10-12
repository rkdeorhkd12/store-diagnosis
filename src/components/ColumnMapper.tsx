import { missingRequired } from '../lib/analyze';
import { guessAmountColumn } from '../lib/guessMapping';
import type { AmountMode, ColumnMapping, ParsedSheet } from '../types';

type FieldKey = 'orderId' | 'productName' | 'option' | 'quantity' | 'amount' | 'status';

interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  help: string;
}

const FIELDS: FieldDef[] = [
  { key: 'orderId', label: '주문번호', required: true, help: '객단가 계산에 쓰입니다. 같은 번호는 주문 1건으로 셉니다.' },
  { key: 'productName', label: '상품명', required: true, help: '상품별 매출을 묶는 기준입니다.' },
  { key: 'option', label: '옵션(컬러·사이즈)', required: false, help: '컬러별 판매 비중에 쓰입니다. 없으면 차트가 비어 있습니다.' },
  { key: 'quantity', label: '수량', required: true, help: '판매 수량입니다.' },
  { key: 'amount', label: '상품금액(줄 단위)', required: true, help: '' },
  { key: 'status', label: '주문상태', required: false, help: '"취소·반품·환불"이 들어간 줄을 집계에서 뺍니다.' },
];

const ORDER_LEVEL_AMOUNT = /결제|배송|총\s*주문금액$|실결제/;

interface Props {
  sheet: ParsedSheet;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
}

export default function ColumnMapper({ sheet, mapping, onChange, onBack, onSubmit, error }: Props) {
  const missing = missingRequired(mapping);
  const sample = (col: number | null) => (col === null ? '' : sheet.rows.find((r) => r[col] !== '')?.[col] ?? '');

  const setField = (key: FieldKey, value: string) =>
    onChange({ ...mapping, [key]: value === '' ? null : Number(value) });

  const setMode = (mode: AmountMode) => {
    if (mode === mapping.amountMode) return;
    const taken = [mapping.orderId, mapping.productName, mapping.option, mapping.quantity, mapping.status];
    onChange({ ...mapping, amountMode: mode, amount: guessAmountColumn(sheet.headers, mode, taken) });
  };

  const amountHeader = mapping.amount !== null ? sheet.headers[mapping.amount] : '';
  const amountLooksOrderLevel = ORDER_LEVEL_AMOUNT.test(amountHeader);

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

        <div className="field-list">
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label className="field-label" htmlFor={`map-${f.key}`}>
                {f.label}
                <span className={f.required ? 'badge badge-req' : 'badge'}>{f.required ? '필수' : '선택'}</span>
              </label>

              {f.key === 'amount' && (
                <div className="segmented" role="radiogroup" aria-label="상품금액 계산 방식">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mapping.amountMode === 'line'}
                    className={mapping.amountMode === 'line' ? 'is-on' : ''}
                    onClick={() => setMode('line')}
                  >
                    줄 금액 열
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mapping.amountMode === 'unitPrice'}
                    className={mapping.amountMode === 'unitPrice' ? 'is-on' : ''}
                    onClick={() => setMode('unitPrice')}
                  >
                    판매가 × 수량
                  </button>
                </div>
              )}

              <select
                id={`map-${f.key}`}
                value={mapping[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                className={f.required && mapping[f.key] === null ? 'is-missing' : ''}
              >
                <option value="">{f.required ? '— 열을 선택하세요 —' : '— 사용 안 함 —'}</option>
                {sheet.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>

              {mapping[f.key] !== null && (
                <p className="field-sample small">
                  예: <span>{sample(mapping[f.key]) || '(빈 값)'}</span>
                </p>
              )}

              <p className="muted small">
                {f.key === 'amount'
                  ? mapping.amountMode === 'line'
                    ? '상품 한 줄의 금액 열(예: 상품구매금액, 상품별 총 주문금액). 배송비·주문할인이 섞인 결제금액은 피하세요.'
                    : '상품 1개 가격(판매가) 열을 고르면 수량을 곱해 계산합니다.'
                  : f.help}
              </p>

              {f.key === 'amount' && amountLooksOrderLevel && (
                <p className="warn small">
                  "{amountHeader}"은(는) 주문 단위 금액일 수 있습니다. 줄마다 반복되거나 배송비가 섞이면 상품 매출이
                  부풀려집니다.
                </p>
              )}
            </div>
          ))}
        </div>
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
        <button className="btn btn-primary" onClick={onSubmit} disabled={missing.length > 0}>
          {missing.length > 0 ? `필수 항목 ${missing.length}개 남음` : '진단하기'}
        </button>
      </div>
    </section>
  );
}
