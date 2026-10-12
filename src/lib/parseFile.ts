import type { ParsedSheet } from '../types';

/**
 * CSV 바이트를 문자열로 디코딩한다.
 * UTF-8로 읽어 깨진 문자(U+FFFD)가 나오면 EUC-KR로 다시 읽는다.
 */
export function decodeCsv(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  try {
    return new TextDecoder('euc-kr').decode(bytes);
  } catch {
    return utf8;
  }
}

const NUMBER_LIKE = /^[\d\s,.\-:/()₩원]+$/;

/**
 * 헤더 행을 찾는다: 앞쪽 10줄 중 숫자가 아닌 글자 셀이 가장 많은 첫 줄.
 * (헤더에 빈 칸이 있어도 숫자로 꽉 찬 데이터 행이 헤더로 잡히지 않게 한다)
 */
function findHeaderRow(matrix: string[][]): number {
  let best = 0;
  let bestCount = -1;
  const limit = Math.min(matrix.length, 10);
  for (let i = 0; i < limit; i++) {
    const count = matrix[i].filter((c) => c !== '' && !NUMBER_LIKE.test(c)).length;
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  }
  return best;
}

const TOTAL_ROW = /^(합계|총계|소계|total)$/i;

/** 2차원 배열에서 헤더와 데이터 행을 분리하고 빈 행·합계 행을 제거한다. */
export function toParsedSheet(fileName: string, matrix: unknown[][]): ParsedSheet {
  const strMatrix = matrix.map((row) =>
    (row ?? []).map((cell) => (cell == null ? '' : String(cell).trim())),
  );
  if (strMatrix.length === 0) {
    return { fileName, headers: [], rows: [] };
  }

  const headerIdx = findHeaderRow(strMatrix);
  const rawHeaders = strMatrix[headerIdx];
  const width = Math.max(...strMatrix.map((r) => r.length));

  // 이름이 비었거나 중복된 열에 구분 가능한 이름을 붙인다.
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, i) => {
    const base = rawHeaders[i] || `열 ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });

  const rows = strMatrix
    .slice(headerIdx + 1)
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
    .filter((r) => r.some((c) => c !== ''))
    .filter((r) => !r.some((c) => TOTAL_ROW.test(c)));

  return { fileName, headers, rows };
}

/** 브라우저 안에서만 파일을 읽는다. 네트워크 전송 없음. */
export async function parseFile(file: File): Promise<ParsedSheet> {
  // SheetJS는 크기가 커서 파일을 올릴 때만 불러온다.
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';

  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('시트를 찾을 수 없습니다.');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  return toParsedSheet(file.name, matrix);
}
