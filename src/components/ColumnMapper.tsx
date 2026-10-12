import { missingRequired } from '../lib/analyze';
import { guessAmountColumn } from '../lib/guessMapping';
import type { AmountMode, ColumnMapping, ParsedSheet } from '../types';
import { MappingField, MappingShell } from './MappingShell';

type FieldKey = 'orderId' | 'orderDate' | 'productName' | 'option' | 'quantity' | 'amount' | 'status';

interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  help: string;
}

const FIELDS: FieldDef[] = [
  { key: 'orderId', label: '주문번호', required: true, help: '객단가 계산에 쓰입니다. 같은 번호는 주문 1건으로 셉니다.' },
  { key: 'orderDate', label: '주문일시', required: false, help: '기간별 매출 추이에 쓰입니다. 시간은 빼고 날짜만 봅니다.' },
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
  const setMode = (mode: AmountMode) => {
    if (mode === mapping.amountMode) return;
    const taken = [mapping.orderId, mapping.orderDate, mapping.productName, mapping.option, mapping.quantity, mapping.status];
    onChange({ ...mapping, amountMode: mode, amount: guessAmountColumn(sheet.headers, mode, taken) });
  };

  const amountHeader = mapping.amount !== null ? sheet.headers[mapping.amount] : '';
  const amountHelp =
    mapping.amountMode === 'line'
      ? '상품 한 줄의 금액 열(예: 상품구매금액, 상품별 총 주문금액). 배송비·주문할인이 섞인 결제금액은 피하세요.'
      : '상품 1개 가격(판매가) 열을 고르면 수량을 곱해 계산합니다.';

  return (
    <MappingShell
      sheet={sheet}
      missingCount={missingRequired(mapping).length}
      onBack={onBack}
      onSubmit={onSubmit}
      error={error}
    >
      {FIELDS.map((f) => (
        <MappingField
          key={f.key}
          id={f.key}
          label={f.label}
          required={f.required}
          value={mapping[f.key]}
          sheet={sheet}
          help={f.key === 'amount' ? amountHelp : f.help}
          onChange={(col) => onChange({ ...mapping, [f.key]: col })}
          before={
            f.key === 'amount' && (
              <div className="segmented" role="radiogroup" aria-label="상품금액 계산 방식">
                {(['line', 'unitPrice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mapping.amountMode === m}
                    className={mapping.amountMode === m ? 'is-on' : ''}
                    onClick={() => setMode(m)}
                  >
                    {m === 'line' ? '줄 금액 열' : '판매가 × 수량'}
                  </button>
                ))}
              </div>
            )
          }
          after={
            f.key === 'amount' &&
            ORDER_LEVEL_AMOUNT.test(amountHeader) && (
              <p className="warn small">
                "{amountHeader}"은(는) 주문 단위 금액일 수 있습니다. 줄마다 반복되거나 배송비가 섞이면 상품 매출이
                부풀려집니다.
              </p>
            )
          }
        />
      ))}
    </MappingShell>
  );
}
