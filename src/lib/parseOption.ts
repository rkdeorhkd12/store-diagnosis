export const UNSPECIFIED_COLOR = '미지정';

const COLOR_KEY = /색상|컬러|칼라|color|colour/i;
const NON_COLOR_KEY = /사이즈|크기|size|수량|qty|용량|길이|타입|type/i;
const SIZE_VALUE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|free|f|프리|onesize|one size|\d+(\.\d+)?\s*(cm|mm|ml|g|kg|호)?)$/i;

interface OptionPart {
  key: string | null;
  value: string;
}

/** "색상: 블랙 / 사이즈: M", "색상=블랙, 사이즈=M", "[색상]블랙", "블랙/M" 등을 조각으로 나눈다. */
export function splitOption(option: string): OptionPart[] {
  return option
    .split(/\s*[/,|;\n]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const bracket = part.match(/^\[(.+?)\]\s*(.+)$/);
      if (bracket) return { key: bracket[1].trim(), value: bracket[2].trim() };
      const kv = part.match(/^([^:=]+?)\s*[:=]\s*(.+)$/);
      if (kv) return { key: kv[1].trim(), value: kv[2].trim() };
      return { key: null, value: part };
    });
}

/**
 * 옵션 문자열에서 컬러를 뽑는다.
 * 1) 색상/컬러/Color 키가 있으면 그 값
 * 2) 없으면 사이즈 등이 아닌 첫 번째 값
 * 3) 찾지 못하면 "미지정"
 */
export function extractColor(option: string): string {
  const parts = splitOption(option);
  if (parts.length === 0) return UNSPECIFIED_COLOR;

  const keyed = parts.find((p) => p.key && COLOR_KEY.test(p.key));
  if (keyed) return keyed.value;

  const fallback = parts.find(
    (p) => !(p.key && NON_COLOR_KEY.test(p.key)) && !SIZE_VALUE.test(p.value),
  );
  return fallback ? fallback.value : UNSPECIFIED_COLOR;
}
