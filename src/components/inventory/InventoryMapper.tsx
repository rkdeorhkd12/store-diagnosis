import { missingInventoryRequired } from '../../lib/inventory';
import type { InventoryMapping, ParsedSheet } from '../../types';
import { MappingField, MappingShell } from '../MappingShell';

const FIELDS: { key: keyof InventoryMapping; label: string; required: boolean; help: string }[] = [
  { key: 'productName', label: '상품명', required: true, help: '같은 상품명+옵션은 한 줄로 합쳐 판정합니다.' },
  { key: 'option', label: '옵션(컬러·사이즈)', required: false, help: '옵션 단위로 판정합니다. 없으면 상품 단위로 판정합니다.' },
  { key: 'sales', label: '판매량', required: true, help: '조회 기간 판매량. 판매량 상위 N%(리오더 우선) 판단에 씁니다.' },
  { key: 'stock', label: '현재 재고', required: true, help: '지금 판매 가능한 재고 수량입니다.' },
  { key: 'weeklySales', label: '주간 판매량', required: true, help: '1주일 평균 판매량. 부족·소진임박 판정과 예상 소진일에 씁니다.' },
  { key: 'location', label: '로케이션', required: false, help: '결과 표에 보관 위치를 함께 보여 줍니다.' },
];

interface Props {
  sheet: ParsedSheet;
  mapping: InventoryMapping;
  onChange: (m: InventoryMapping) => void;
  onBack: () => void;
  onSubmit: () => void;
  error: string | null;
}

export default function InventoryMapper({ sheet, mapping, onChange, onBack, onSubmit, error }: Props) {
  return (
    <MappingShell
      sheet={sheet}
      missingCount={missingInventoryRequired(mapping).length}
      onBack={onBack}
      onSubmit={onSubmit}
      error={error}
    >
      {FIELDS.map((f) => (
        <MappingField
          key={f.key}
          id={`inv-${f.key}`}
          label={f.label}
          required={f.required}
          value={mapping[f.key]}
          sheet={sheet}
          help={f.help}
          onChange={(col) => onChange({ ...mapping, [f.key]: col })}
        />
      ))}
    </MappingShell>
  );
}
